import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { Prisma } from '@myais/database';
import { ActiveAccountGuard } from '../dist/auth/active-account.guard.js';
import { SupabaseJwtGuard } from '../dist/auth/supabase-jwt.guard.js';
import { PaymentsController } from '../dist/payments/payments.controller.js';
import { PaymentsService } from '../dist/payments/payments.service.js';
import { InMemoryPrivateStorage } from '../dist/storage/in-memory-private-storage.js';

const ownId = '111e4567-e89b-42d3-a456-426614174000';
const otherId = '111e4567-e89b-42d3-a456-426614174001';
const applicationId = '222e4567-e89b-42d3-a456-426614174000';
const paymentId = '333e4567-e89b-42d3-a456-426614174000';
const typeId = '444e4567-e89b-42d3-a456-426614174000';

function payment(overrides = {}) {
  return {
    id: paymentId,
    paymentReference: 'MYAIS-PAY-2026-000001',
    userId: ownId,
    applicationId,
    membershipId: null,
    paymentType: 'ENTRANCE_AND_ANNUAL',
    entranceFee: new Prisma.Decimal(100),
    membershipFee: new Prisma.Decimal(50),
    totalAmount: new Prisma.Decimal(150),
    currency: 'MYR',
    paymentMethod: null,
    bankName: null,
    transactionReference: null,
    receiptUrl: 'https://legacy.example/receipt',
    receiptObjectKey: null,
    status: 'NOT_SUBMITTED',
    paidAt: null,
    submittedAt: null,
    verifiedByUserId: null,
    verifiedAt: null,
    rejectionReason: null,
    treasurerRemarks: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function application(overrides = {}) {
  return {
    id: applicationId,
    applicationNumber: 'MYAIS-APP-2026-000001',
    userId: ownId,
    status: 'APPROVED_PENDING_PAYMENT',
    approvedMembershipTypeId: typeId,
    approvedMembershipTypeCode: 'ORDINARY',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    user: {
      email: 'applicant@example.test',
      fullName: 'Applicant Name',
      legacyFullName: null,
      memberProfileByUser: { fullName: 'Applicant Profile' },
    },
    ...overrides,
  };
}

function applicantDatabase(options = {}) {
  const state = {
    applications: options.applications ?? [application()],
    payments: options.payments === undefined ? [payment()] : options.payments,
    types: [{ id: typeId, code: 'ORDINARY', name: 'Ordinary Member',
      entranceFee: new Prisma.Decimal(100), membershipFee: new Prisma.Decimal(50) }],
    audits: [],
    notifications: [],
    locks: 0,
  };
  let paymentSequence = state.payments.length;
  let queue = Promise.resolve();
  const decorateApplication = row => {
    const selectedType = state.types.find(type => type.id === row.approvedMembershipTypeId) ?? null;
    const selectedPayment = state.payments.find(value => value.applicationId === row.id) ?? null;
    return { ...row, approvedMembershipType: selectedType, paymentByApplication: selectedPayment };
  };
  const client = {
    membershipApplication: {
      async findFirst({ where }) {
        const row = state.applications.find(value => value.userId === where.userId &&
          (!where.id || value.id === where.id) &&
          (!where.status || (typeof where.status === 'string' ? value.status === where.status : true)));
        if (!row) return null;
        if (where.OR) {
          const relevant = ['APPROVED_PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAYMENT_UNDER_VERIFICATION']
            .includes(row.status) || (row.status === 'ACTIVE' &&
              state.payments.some(value => value.applicationId === row.id && value.status === 'VERIFIED'));
          if (!relevant) return null;
        }
        return decorateApplication(row);
      },
      async update({ where, data }) {
        const row = state.applications.find(value => value.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    payment: {
      async findFirst({ where }) {
        const row = state.payments.find(value => value.id === where.id && value.userId === where.userId &&
          value.applicationId === where.applicationId);
        if (!row) return null;
        const app = state.applications.find(value => value.id === row.applicationId);
        return { ...row, application: app ? { ...app } : null };
      },
      async findMany({ where }) {
        return state.payments.filter(value => value.paymentReference?.startsWith(where.paymentReference.startsWith))
          .map(value => ({ paymentReference: value.paymentReference }));
      },
      async create({ data }) {
        if (state.payments.some(value => value.applicationId === data.applicationId)) {
          throw new Error('unique application payment');
        }
        paymentSequence++;
        const row = payment({ id: `333e4567-e89b-42d3-a456-4266141740${String(paymentSequence).padStart(2, '0')}`,
          receiptUrl: null, ...data });
        state.payments.push(row);
        return row;
      },
      async update({ where, data }) {
        const row = state.payments.find(value => value.id === where.id);
        const update = { ...data };
        if (update.verifiedByUser?.disconnect) {
          update.verifiedByUserId = null;
          delete update.verifiedByUser;
        }
        Object.assign(row, update);
        return row;
      },
    },
    auditLog: { async create({ data }) {
      if (options.failAudit) throw new Error('audit insert failed');
      state.audits.push(data);
      return data;
    } },
    notification: { async create({ data }) { state.notifications.push(data); return data; } },
    async $queryRaw() { state.locks++; return []; },
    async $transaction(work) {
      const run = queue.then(async () => {
        const snapshot = {
          applications: state.applications.map(row => ({ ...row })),
          payments: state.payments.map(row => ({ ...row })),
          audits: [...state.audits],
          notifications: [...state.notifications],
        };
        try { return await work(client); }
        catch (error) {
          Object.assign(state, snapshot);
          throw error;
        }
      });
      queue = run.catch(() => undefined);
      return run;
    },
  };
  const storage = new InMemoryPrivateStorage();
  return { state, storage, service: new PaymentsService({ client }, storage) };
}

async function upload(database, metadata = {}) {
  const target = await database.service.initiateReceiptUpload(ownId, {
    originalFileName: 'receipt.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    ...metadata,
  });
  database.storage.completeUpload(target.uploadToken);
  return target.uploadToken;
}

async function seedObject(storage, objectKey) {
  const target = await storage.createUploadTarget({ objectKey, contentType: 'application/pdf', contentLength: 100,
    expiresInSeconds: 300, context: {} });
  storage.completeUpload(target.uploadToken);
  await storage.confirmUpload(target.uploadToken);
}

test('applicant payment routes require JWT plus ACTIVE account guards and derive ownership', async () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, PaymentsController),
    [SupabaseJwtGuard, ActiveAccountGuard]);
  let owner;
  const controller = new PaymentsController({ currentOwn: async id => { owner = id; return null; } });
  await controller.current({ id: ownId });
  assert.equal(owner, ownId);
});

test('current payment read is owner-scoped, supports verified history, and omits private fields', async () => {
  const database = applicantDatabase();
  const result = await database.service.currentOwn(ownId);
  assert.equal(result.payment.paymentReference, 'MYAIS-PAY-2026-000001');
  assert.equal(result.payment.totalAmount, '150');
  assert.equal(result.approvedMembershipType.name, 'Ordinary Member');
  assert.equal(await database.service.currentOwn(otherId), null);
  const serialized = JSON.stringify(result);
  for (const hidden of ['receiptUrl', 'receiptObjectKey', 'verifiedByUserId', 'applicationId', 'userId',
    'https://legacy.example']) assert(!serialized.includes(hidden));

  database.state.applications[0].status = 'ACTIVE';
  database.state.payments[0].status = 'VERIFIED';
  assert.equal((await database.service.currentOwn(ownId)).payment.status, 'VERIFIED');
});

test('receipt upload enforces PDF/JPEG/PNG, 5MB, provider completion, and opaque server keys', async () => {
  for (const mimeType of ['application/pdf', 'image/jpeg', 'image/png']) {
    const database = applicantDatabase();
    const target = await database.service.initiateReceiptUpload(ownId,
      { originalFileName: 'receipt', mimeType, fileSize: 5 * 1024 * 1024 });
    assert.match(target.uploadToken, /^[0-9a-f-]{36}$/);
  }
  for (const input of [
    { originalFileName: 'receipt.pdf', mimeType: 'text/plain', fileSize: 100 },
    { originalFileName: 'receipt.pdf', mimeType: 'application/pdf', fileSize: 5 * 1024 * 1024 + 1 },
    { originalFileName: 'receipt.pdf', mimeType: 'application/pdf', fileSize: 100, receiptObjectKey: 'forged' },
  ]) {
    await assert.rejects(applicantDatabase().service.initiateReceiptUpload(ownId, input),
      error => error.getStatus() === 400);
  }
  await assert.rejects(applicantDatabase().service.finalizeReceiptAndSubmit(ownId, {
    uploadToken: 'missing', paymentMethod: 'BANK_TRANSFER', transactionReference: 'BANK-1',
  }), error => error.getStatus() === 400);

  const forged = applicantDatabase();
  const target = await forged.service.initiateReceiptUpload(ownId,
    { originalFileName: 'receipt.pdf', mimeType: 'application/pdf', fileSize: 100 });
  forged.storage.completeUpload(target.uploadToken, { contentType: 'image/png', contentLength: 101 });
  await assert.rejects(forged.service.finalizeReceiptAndSubmit(ownId, {
    uploadToken: target.uploadToken, paymentMethod: 'BANK_TRANSFER', transactionReference: 'BANK-1',
  }), error => error.getStatus() === 400);
});

test('NOT_SUBMITTED payment finalization submits exact fields, audit, and notification', async () => {
  const database = applicantDatabase();
  const uploadToken = await upload(database);
  const result = await database.service.finalizeReceiptAndSubmit(ownId, {
    uploadToken,
    paymentMethod: 'ONLINE_BANKING',
    bankName: 'Example Bank',
    transactionReference: ' TXN-123 ',
    paidAt: '2026-02-28',
  });
  assert.equal(result.status, 'SUBMITTED');
  const row = database.state.payments[0];
  assert.equal(row.status, 'SUBMITTED');
  assert.equal(row.paymentMethod, 'ONLINE_BANKING');
  assert.equal(row.bankName, 'Example Bank');
  assert.equal(row.transactionReference, 'TXN-123');
  assert.equal(row.paidAt.toISOString(), '2026-02-28T00:00:00.000Z');
  assert(row.submittedAt instanceof Date);
  assert.match(row.receiptObjectKey, new RegExp(`^payments/${paymentId}/[0-9a-f-]{36}$`));
  assert.equal(row.receiptUrl, 'https://legacy.example/receipt');
  assert.equal(database.state.applications[0].status, 'PAYMENT_SUBMITTED');
  assert.deepEqual(database.state.audits, [{ actorUserId: ownId, actorName: 'Applicant Profile',
    action: 'PAYMENT_SUBMITTED', entityType: 'Payment',
    description: 'Payment submitted for application MYAIS-APP-2026-000001' }]);
  assert.deepEqual(database.state.notifications, [{ userId: ownId, title: 'Payment Submitted',
    message: 'Your payment evidence was submitted and is awaiting verification.', type: 'PAYMENT',
    eventType: 'PAYMENT_SUBMITTED', relatedEntityType: 'Payment', actionUrl: '/my-application/payment' }]);
});

test('submission strictly rejects invalid applicant and server-owned fields', async () => {
  for (const invalid of [
    { paymentMethod: 'DUITNOW', transactionReference: 'TX' },
    { paymentMethod: 'BANK_TRANSFER', transactionReference: '   ' },
    { paymentMethod: 'BANK_TRANSFER', transactionReference: 'TX', totalAmount: 1 },
    { paymentMethod: 'BANK_TRANSFER', transactionReference: 'TX', paymentReference: 'FORGED' },
    { paymentMethod: 'BANK_TRANSFER', transactionReference: 'TX', receiptObjectKey: 'FORGED' },
    { paymentMethod: 'BANK_TRANSFER', transactionReference: 'TX', userId: otherId },
  ]) {
    const database = applicantDatabase();
    const uploadToken = await upload(database);
    await assert.rejects(database.service.finalizeReceiptAndSubmit(ownId, { uploadToken, ...invalid }),
      error => error.getStatus() === 400);
  }
});

test('REJECTED resubmission replaces receipt only after commit and clears stale review metadata', async () => {
  const oldKey = `payments/${paymentId}/old-object`;
  const database = applicantDatabase({ payments: [payment({
    status: 'REJECTED', receiptObjectKey: oldKey, rejectionReason: 'Old rejection',
    treasurerRemarks: 'Old rejection', verifiedByUserId: otherId,
    verifiedAt: new Date('2026-01-01T00:00:00Z'),
  })] });
  await seedObject(database.storage, oldKey);
  const uploadToken = await upload(database, { mimeType: 'image/png', originalFileName: 'replacement.png' });
  await database.service.finalizeReceiptAndSubmit(ownId, {
    uploadToken, paymentMethod: 'CASH_DEPOSIT', transactionReference: 'NEW-1',
  });
  const row = database.state.payments[0];
  assert.equal(row.status, 'SUBMITTED');
  assert.equal(row.rejectionReason, null);
  assert.equal(row.treasurerRemarks, null);
  assert.equal(row.verifiedByUserId, null);
  assert.equal(row.verifiedAt, null);
  assert(database.storage.deletedObjectKeys.includes(oldKey));
});

test('repeated and concurrent submissions commit exactly one transition and audit', async () => {
  const database = applicantDatabase();
  const firstToken = await upload(database);
  const secondToken = await upload(database, { originalFileName: 'second.pdf' });
  const submit = uploadToken => database.service.finalizeReceiptAndSubmit(ownId, {
    uploadToken, paymentMethod: 'BANK_TRANSFER', transactionReference: uploadToken,
  });
  const results = await Promise.allSettled([submit(firstToken), submit(secondToken)]);
  assert.deepEqual(results.map(result => result.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(results.find(result => result.status === 'rejected').reason.getStatus(), 409);
  assert.equal(database.state.audits.length, 1);
  assert.equal(database.state.applications[0].status, 'PAYMENT_SUBMITTED');
});

test('fallback payment creation is server-owned and concurrency-safe', async () => {
  const database = applicantDatabase({ payments: [] });
  const results = await Promise.all([
    database.service.initiateReceiptUpload(ownId,
      { originalFileName: 'a.pdf', mimeType: 'application/pdf', fileSize: 100 }),
    database.service.initiateReceiptUpload(ownId,
      { originalFileName: 'b.pdf', mimeType: 'application/pdf', fileSize: 100 }),
  ]);
  assert.equal(results.length, 2);
  assert.equal(database.state.payments.length, 1);
  const row = database.state.payments[0];
  assert.match(row.paymentReference, /^MYAIS-PAY-\d{4}-\d{6}$/);
  assert.equal(row.totalAmount.toString(), '150');
  assert.equal(row.userId, ownId);
  assert.equal(row.applicationId, applicationId);
  assert.equal(row.status, 'NOT_SUBMITTED');
});

test('failed submission transaction leaves payment/application unchanged and deletes only the new object', async () => {
  const oldKey = `payments/${paymentId}/old-object`;
  const database = applicantDatabase({ failAudit: true, payments: [payment({
    status: 'REJECTED', receiptObjectKey: oldKey, rejectionReason: 'Keep me', treasurerRemarks: 'Keep me',
  })] });
  await seedObject(database.storage, oldKey);
  const uploadToken = await upload(database);
  await assert.rejects(database.service.finalizeReceiptAndSubmit(ownId, {
    uploadToken, paymentMethod: 'BANK_TRANSFER', transactionReference: 'TX',
  }), /audit insert failed/);
  assert.equal(database.state.payments[0].status, 'REJECTED');
  assert.equal(database.state.payments[0].receiptObjectKey, oldKey);
  assert.equal(database.state.applications[0].status, 'APPROVED_PENDING_PAYMENT');
  assert(!database.storage.deletedObjectKeys.includes(oldKey));
});
