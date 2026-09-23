import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { ActiveAccountGuard } from '../dist/auth/active-account.guard.js';
import { SupabaseJwtGuard } from '../dist/auth/supabase-jwt.guard.js';
import { InformationRequestsController } from '../dist/information-requests/information-requests.controller.js';
import { InformationRequestsService } from '../dist/information-requests/information-requests.service.js';
import { InMemoryPrivateStorage } from '../dist/storage/in-memory-private-storage.js';

const ownId = '111e4567-e89b-42d3-a456-426614174000';
const otherId = '111e4567-e89b-42d3-a456-426614174001';
const applicationId = '222e4567-e89b-42d3-a456-426614174000';
const requestId = '333e4567-e89b-42d3-a456-426614174000';
const unrelatedRequestId = '333e4567-e89b-42d3-a456-426614174001';

function informationDatabase(options = {}) {
  const state = {
    application: { id: applicationId, userId: ownId, status: 'ADDITIONAL_INFORMATION_REQUIRED',
      applicationNumber: 'MYAIS-APP-2026-000001', user: { fullName: 'Applicant Name',
        legacyFullName: null, email: 'applicant@example.test' }, ...options.application },
    requests: [
      { id: requestId, applicationId, status: 'OPEN', applicantResponse: null,
        responseAttachmentObjectKey: null, respondedAt: null },
      { id: unrelatedRequestId, applicationId, status: 'OPEN', applicantResponse: null,
        responseAttachmentObjectKey: null, respondedAt: null },
    ],
    audits: [], locks: 0,
  };
  if (options.requestStatus) state.requests[0].status = options.requestStatus;
  let queue = Promise.resolve();
  const client = {
    membershipApplication: {
      async findFirst({ where }) {
        return state.application.id === where.id && state.application.userId === where.userId
          ? state.application : null;
      },
      async update({ where, data }) {
        assert.equal(where.id, applicationId);
        Object.assign(state.application, data);
        return state.application;
      },
    },
    informationRequest: {
      async findFirst({ where }) {
        return state.requests.find(row => row.id === where.id && row.applicationId === where.applicationId) ?? null;
      },
      async update({ where, data }) {
        const row = state.requests.find(value => value.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    auditLog: { async create({ data }) {
      if (options.failAudit) throw new Error('audit insert failed');
      state.audits.push(data); return data;
    } },
    async $queryRaw() { state.locks++; return []; },
    async $transaction(work) {
      const run = queue.then(async () => {
        const snapshot = globalThis.structuredClone(state);
        try { return await work(client); }
        catch (error) { Object.assign(state, snapshot); throw error; }
      });
      queue = run.catch(() => undefined);
      return run;
    },
  };
  const storage = new InMemoryPrivateStorage();
  return { state, storage, service: new InformationRequestsService({ client }, storage) };
}

test('information-request controller is JWT/ACTIVE guarded and derives principal ownership', async () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, InformationRequestsController),
    [SupabaseJwtGuard, ActiveAccountGuard]);
  let owner;
  const controller = new InformationRequestsController({
    respond: async userId => { owner = userId; return {}; },
  });
  await controller.respond({ id: ownId }, applicationId, requestId, { response: 'Response' });
  assert.equal(owner, ownId);
});

test('valid selected OPEN response changes only that request and returns application to review', async () => {
  const database = informationDatabase();
  const result = await database.service.respond(ownId, applicationId, requestId,
    { response: '  Applicant response  ' });
  assert.equal(result.status, 'RESPONDED');
  assert.equal(result.applicationStatus, 'UNDER_REVIEW');
  assert.equal(result.attachmentUploaded, false);
  assert.equal(database.state.requests[0].applicantResponse, '  Applicant response  ');
  assert.equal(database.state.requests[0].status, 'RESPONDED');
  assert(database.state.requests[0].respondedAt instanceof Date);
  assert.equal(database.state.requests[1].status, 'OPEN');
  assert.equal(database.state.application.status, 'UNDER_REVIEW');
  assert.deepEqual(database.state.audits, [{ actorUserId: ownId, actorName: 'Applicant Name',
    action: 'INFO_RESPONSE_SUBMITTED', entityType: 'InformationRequest',
    description: 'Applicant responded to information request for MYAIS-APP-2026-000001' }]);
});

test('blank responses and client-owned attachment keys/fields are rejected', async () => {
  for (const input of [{ response: '' }, { response: '   ' },
    { response: 'Valid', responseAttachmentObjectKey: 'client/chosen' },
    { response: 'Valid', status: 'RESPONDED' }, { response: 'Valid', userId: otherId }]) {
    await assert.rejects(informationDatabase().service.respond(ownId, applicationId, requestId, input),
      error => error.getStatus() === 400);
  }
});

test('ownership, application status, and request OPEN state are enforced without disclosure', async () => {
  await assert.rejects(informationDatabase().service.respond(otherId, applicationId, requestId,
    { response: 'Response' }), error => error.getStatus() === 404);
  await assert.rejects(informationDatabase({ application: { status: 'UNDER_REVIEW' } }).service
    .respond(ownId, applicationId, requestId, { response: 'Response' }), error => error.getStatus() === 409);
  await assert.rejects(informationDatabase({ requestStatus: 'RESPONDED' }).service
    .respond(ownId, applicationId, requestId, { response: 'Response' }), error => error.getStatus() === 409);
});

test('optional attachment uses an opaque private upload token and persists only its object key', async () => {
  const database = informationDatabase();
  const target = await database.service.initiateAttachmentUpload(ownId, applicationId, requestId, {
    originalFileName: 'evidence.png', mimeType: 'image/png', fileSize: 123,
  });
  assert.match(target.uploadUrl, /^memory-private-upload:/);
  assert(!JSON.stringify(target).includes('information-requests/'));
  database.storage.completeUpload(target.uploadToken);
  const result = await database.service.respond(ownId, applicationId, requestId,
    { response: 'Attached response', attachmentUploadToken: target.uploadToken });
  assert.equal(result.attachmentUploaded, true);
  assert.match(database.state.requests[0].responseAttachmentObjectKey,
    new RegExp(`^information-requests/${requestId}/[0-9a-f-]{36}$`));
  assert(!JSON.stringify(result).includes('responseAttachmentObjectKey'));
});

test('attachment authorization rejects invalid metadata and an uncompleted object', async () => {
  const database = informationDatabase();
  await assert.rejects(database.service.initiateAttachmentUpload(ownId, applicationId, requestId, {
    originalFileName: 'large.pdf', mimeType: 'application/pdf', fileSize: 5 * 1024 * 1024 + 1,
  }), error => error.getStatus() === 400);
  const target = await database.service.initiateAttachmentUpload(ownId, applicationId, requestId, {
    originalFileName: 'evidence.pdf', mimeType: 'application/pdf', fileSize: 123,
  });
  await assert.rejects(database.service.respond(ownId, applicationId, requestId,
    { response: 'Response', attachmentUploadToken: target.uploadToken }), error => error.getStatus() === 400);
  assert.equal(database.state.requests[0].status, 'OPEN');
});

test('failed information-response transaction rolls both request and application state back', async () => {
  const database = informationDatabase({ failAudit: true });
  await assert.rejects(database.service.respond(ownId, applicationId, requestId,
    { response: 'Response' }), /audit insert failed/);
  assert.equal(database.state.requests[0].status, 'OPEN');
  assert.equal(database.state.requests[0].applicantResponse, null);
  assert.equal(database.state.application.status, 'ADDITIONAL_INFORMATION_REQUIRED');
  assert.equal(database.state.audits.length, 0);
});
