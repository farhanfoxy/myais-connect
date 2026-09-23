import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { ActiveAccountGuard } from '../dist/auth/active-account.guard.js';
import { SupabaseJwtGuard } from '../dist/auth/supabase-jwt.guard.js';
import { ApplicationDocumentsController } from '../dist/application-documents/application-documents.controller.js';
import { ApplicationDocumentsService } from '../dist/application-documents/application-documents.service.js';
import { InMemoryPrivateStorage } from '../dist/storage/in-memory-private-storage.js';

const ownId = '111e4567-e89b-42d3-a456-426614174000';
const otherId = '111e4567-e89b-42d3-a456-426614174001';
const applicationId = '222e4567-e89b-42d3-a456-426614174000';
const otherApplicationId = '222e4567-e89b-42d3-a456-426614174001';

function documentDatabase() {
  const state = {
    applications: [
      { id: applicationId, userId: ownId, status: 'DRAFT' },
      { id: otherApplicationId, userId: otherId, status: 'DRAFT' },
    ],
    documents: [],
  };
  let sequence = 0;
  let queue = Promise.resolve();
  const application = id => state.applications.find(row => row.id === id);
  const client = {
    membershipApplication: {
      async findFirst({ where }) {
        return state.applications.find(row => row.id === where.id && row.userId === where.userId) ?? null;
      },
    },
    applicationDocument: {
      async create({ data }) {
        sequence++;
        const row = { id: `333e4567-e89b-42d3-a456-42661417400${sequence}`,
          createdAt: new Date(`2026-01-0${sequence}T00:00:00.000Z`), verifiedAt: null,
          reviewerRemarks: null, ...data };
        state.documents.push(row);
        return row;
      },
      async findMany({ where }) {
        return state.documents.filter(row => row.applicationId === where.applicationId && row.userId === where.userId);
      },
      async findFirst({ where, select }) {
        const row = state.documents.find(value => value.id === where.id &&
          value.applicationId === where.applicationId && value.userId === where.userId);
        if (!row) return null;
        if (select?.application) return { storageObjectKey: row.storageObjectKey,
          application: { status: application(row.applicationId).status } };
        return { storageObjectKey: row.storageObjectKey };
      },
      async delete({ where }) {
        const index = state.documents.findIndex(row => row.id === where.id);
        const [deleted] = state.documents.splice(index, 1);
        return deleted;
      },
    },
    async $queryRaw() { return []; },
    async $transaction(work) {
      const run = queue.then(() => work(client));
      queue = run.catch(() => undefined);
      return run;
    },
  };
  const storage = new InMemoryPrivateStorage();
  return { state, storage, service: new ApplicationDocumentsService({ client }, storage) };
}

async function upload(database, metadata) {
  const target = await database.service.initiateUpload(ownId, applicationId, metadata);
  database.storage.completeUpload(target.uploadToken);
  return database.service.finalizeUpload(ownId, applicationId, { uploadToken: target.uploadToken });
}

test('document controller is JWT/ACTIVE guarded and derives ownership from the principal', async () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, ApplicationDocumentsController),
    [SupabaseJwtGuard, ActiveAccountGuard]);
  let owner;
  const controller = new ApplicationDocumentsController({
    listOwn: async userId => { owner = userId; return []; },
  });
  await controller.listOwn({ id: ownId }, applicationId);
  assert.equal(owner, ownId);
});

test('PDF/JPEG/PNG uploads use opaque server keys and duplicate document types create rows', async () => {
  const database = documentDatabase();
  for (const [index, mimeType] of ['application/pdf', 'image/jpeg', 'image/png'].entries()) {
    const created = await upload(database, { documentType: index === 0 ? 'IDENTIFICATION' : 'PROFILE_PHOTO',
      originalFileName: `file-${index}`, mimeType, fileSize: 100 + index });
    assert.equal(created.mimeType, mimeType);
    assert.equal(created.downloadAvailable, true);
  }
  await upload(database, { documentType: 'IDENTIFICATION', originalFileName: 'replacement.pdf',
    mimeType: 'application/pdf', fileSize: 200 });
  assert.equal(database.state.documents.filter(row => row.documentType === 'IDENTIFICATION').length, 2);
  for (const row of database.state.documents) {
    assert.match(row.storageObjectKey, new RegExp(`^applications/${applicationId}/[0-9a-f-]{36}$`));
    assert.equal(row.fileUrl, undefined);
    assert.equal(row.verificationStatus, 'PENDING');
  }
});

test('upload input rejects invalid MIME, oversized files, and client-owned fields', async () => {
  const { service } = documentDatabase();
  const base = { documentType: 'IDENTIFICATION', originalFileName: 'id.pdf',
    mimeType: 'application/pdf', fileSize: 10 };
  for (const input of [
    { ...base, mimeType: 'text/plain' },
    { ...base, fileSize: 5 * 1024 * 1024 + 1 },
    { ...base, storageObjectKey: 'client/chosen' },
    { ...base, userId: otherId },
    { ...base, verificationStatus: 'VERIFIED' },
  ]) {
    await assert.rejects(service.initiateUpload(ownId, applicationId, input),
      error => error.getStatus() === 400);
  }
});

test('nonexistent and provider-mismatched uploads cannot finalize', async () => {
  const database = documentDatabase();
  await assert.rejects(database.service.finalizeUpload(ownId, applicationId,
    { uploadToken: 'not-completed' }), error => error.getStatus() === 400);

  const target = await database.service.initiateUpload(ownId, applicationId, {
    documentType: 'IDENTIFICATION', originalFileName: 'id.pdf', mimeType: 'application/pdf', fileSize: 10,
  });
  database.storage.completeUpload(target.uploadToken, { contentType: 'image/png', contentLength: 99 });
  await assert.rejects(database.service.finalizeUpload(ownId, applicationId,
    { uploadToken: target.uploadToken }), error => error.getStatus() === 400);
  assert.equal(database.state.documents.length, 0);
  assert.equal(database.storage.deletedObjectKeys.length, 1);
});

test('ownership and DRAFT state protect upload, list, download, and deletion', async () => {
  const database = documentDatabase();
  await assert.rejects(database.service.initiateUpload(ownId, otherApplicationId, {
    documentType: 'IDENTIFICATION', originalFileName: 'id.pdf', mimeType: 'application/pdf', fileSize: 10,
  }), error => error.getStatus() === 404);

  const created = await upload(database, { documentType: 'IDENTIFICATION', originalFileName: 'id.pdf',
    mimeType: 'application/pdf', fileSize: 10 });
  const listed = await database.service.listOwn(ownId, applicationId);
  assert.equal(listed.length, 1);
  assert(!JSON.stringify(listed).includes('storageObjectKey'));
  assert(!JSON.stringify(listed).includes('fileUrl'));
  const download = await database.service.downloadOwn(ownId, applicationId, created.id);
  assert.match(download.downloadUrl, /^memory-private-download:/);
  await assert.rejects(database.service.downloadOwn(otherId, applicationId, created.id),
    error => error.getStatus() === 404);

  database.state.applications[0].status = 'SUBMITTED';
  await assert.rejects(database.service.deleteOwn(ownId, applicationId, created.id),
    error => error.getStatus() === 409);
  assert.equal(database.state.documents.length, 1);
  database.state.applications[0].status = 'DRAFT';
  const key = database.state.documents[0].storageObjectKey;
  assert.deepEqual(await database.service.deleteOwn(ownId, applicationId, created.id), { deleted: true });
  assert.equal(database.state.documents.length, 0);
  assert(database.storage.deletedObjectKeys.includes(key));
  assert.equal(await database.storage.getObjectMetadata(key), null);
});

test('legacy URL-only metadata is safe: never returned, signed, or externally deleted', async () => {
  const database = documentDatabase();
  const id = '333e4567-e89b-42d3-a456-426614174099';
  database.state.documents.push({ id, applicationId, userId: ownId, documentType: 'IDENTIFICATION',
    fileUrl: 'https://legacy.example/private-token', storageObjectKey: null, originalFileName: 'legacy.pdf',
    mimeType: 'application/pdf', fileSize: 20, verificationStatus: 'PENDING', reviewerRemarks: null,
    verifiedAt: null, createdAt: new Date('2025-01-01T00:00:00.000Z') });
  assert(!JSON.stringify(await database.service.listOwn(ownId, applicationId)).includes('legacy.example'));
  await assert.rejects(database.service.downloadOwn(ownId, applicationId, id),
    error => error.getStatus() === 409);
  await database.service.deleteOwn(ownId, applicationId, id);
  assert.equal(database.storage.deletedObjectKeys.length, 0);
});
