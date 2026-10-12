import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { Prisma, UserRole } from '@myais/database';
import { ActiveAccountGuard } from '../dist/auth/active-account.guard.js';
import { ROLES_KEY } from '../dist/auth/roles.decorator.js';
import { RolesGuard } from '../dist/auth/roles.guard.js';
import { SupabaseJwtGuard } from '../dist/auth/supabase-jwt.guard.js';
import { myaisBusinessYear } from '../dist/membership-applications/membership-applications.service.js';
import { ReviewerPaymentsController } from '../dist/reviewer-payments/reviewer-payments.controller.js';
import {
  paymentBusinessDate,
  paymentMembershipExpiry,
  ReviewerPaymentsService,
} from '../dist/reviewer-payments/reviewer-payments.service.js';
import { InMemoryPrivateStorage } from '../dist/storage/in-memory-private-storage.js';

const verifierId = '111e4567-e89b-42d3-a456-426614174000';
const applicantId = '111e4567-e89b-42d3-a456-426614174001';
const applicationId = '222e4567-e89b-42d3-a456-426614174000';
const paymentId = '333e4567-e89b-42d3-a456-426614174000';
const typeId = '444e4567-e89b-42d3-a456-426614174000';
const receiptKey = `payments/${paymentId}/opaque-receipt`;
const verifierRoles = [UserRole.TREASURER, UserRole.SYSTEM_ADMINISTRATOR];
const deniedRoles = [UserRole.PRESIDENT, UserRole.DEPUTY_PRESIDENT, UserRole.SECRETARY,
  UserRole.ASSISTANT_SECRETARY, UserRole.COMMITTEE_MEMBER, UserRole.APPLICANT,
  UserRole.ORDINARY_MEMBER, UserRole.LIFETIME_MEMBER, UserRole.ASSOCIATE_MEMBER, UserRole.HONORARY_MEMBER];

function principal(overrides = {}) {
  return { id: verifierId, email: 'treasurer@example.test', fullName: 'Treasurer Name',
    role: UserRole.TREASURER, accountStatus: 'ACTIVE', ...overrides };
}

function membershipType(code = 'ORDINARY', overrides = {}) {
  return { id: typeId, code, name: `${code[0]}${code.slice(1).toLowerCase()} Member`,
    validityMonths: 12, votingRights: true, ...overrides };
}

function application(overrides = {}) {
  return { id: applicationId, userId: applicantId, applicationNumber: 'MYAIS-APP-2026-000001',
    status: 'PAYMENT_SUBMITTED', approvedMembershipTypeId: typeId,
    approvedMembershipTypeCode: 'ORDINARY', ...overrides };
}

function payment(overrides = {}) {
  return { id: paymentId, paymentReference: 'MYAIS-PAY-2026-000001', userId: applicantId,
    applicationId, membershipId: null, entranceFee: new Prisma.Decimal(100),
    membershipFee: new Prisma.Decimal(50), totalAmount: new Prisma.Decimal(150), currency: 'MYR',
    paymentMethod: 'BANK_TRANSFER', bankName: 'Bank', transactionReference: 'TX-1',
    receiptUrl: 'https://legacy.example/receipt', receiptObjectKey: receiptKey, status: 'SUBMITTED',
    paidAt: new Date('2026-01-02T00:00:00Z'), submittedAt: new Date('2026-01-02T01:00:00Z'),
    verifiedByUserId: null, verifiedAt: null, rejectionReason: null, treasurerRemarks: null,
    createdAt: new Date('2026-01-02T01:00:00Z'), ...overrides };
}

function reviewerDatabase(options = {}) {
  const state = {
    users: [{ id: applicantId, email: 'applicant@example.test', fullName: 'Applicant User',
      legacyFullName: 'Legacy Applicant', memberProfileByUser: { fullName: 'Applicant Profile' },
      role: UserRole.APPLICANT }],
    applications: options.applications ?? [application()],
    types: options.types ?? [membershipType()],
    payments: options.payments ?? [payment()],
    memberships: options.memberships ?? [],
    audits: [], notifications: [], reviews: [], locks: 0,
  };
  let membershipSequence = state.memberships.length;
  let queue = Promise.resolve();
  const relatedPayment = row => {
    const user = state.users.find(value => value.id === row.userId);
    const app = state.applications.find(value => value.id === row.applicationId);
    const type = app ? state.types.find(value => value.id === app.approvedMembershipTypeId) : null;
    return { ...row, user, application: app ? { ...app, approvedMembershipType: type } : null };
  };
  const matches = (row, where) => {
    if (where.status && row.status !== where.status) return false;
    const search = where.OR?.[0]?.paymentReference?.contains?.toLowerCase();
    if (!search) return true;
    const related = relatedPayment(row);
    return [row.paymentReference, related.application?.applicationNumber, related.user?.email,
      related.user?.fullName, related.user?.legacyFullName, related.user?.memberProfileByUser?.fullName]
      .some(value => value?.toLowerCase().includes(search));
  };
  const client = {
    payment: {
      async findMany({ where = {}, skip = 0, take = 15 }) {
        return state.payments.filter(row => matches(row, where))
          .sort((left, right) => right.createdAt - left.createdAt || right.id.localeCompare(left.id))
          .slice(skip, skip + take).map(relatedPayment);
      },
      async count({ where = {} }) { return state.payments.filter(row => matches(row, where)).length; },
      async findUnique({ where }) {
        const row = state.payments.find(value => value.id === where.id);
        return row ? relatedPayment(row) : null;
      },
      async update({ where, data }) {
        const row = state.payments.find(value => value.id === where.id);
        const update = { ...data };
        if (update.verifiedByUser) {
          update.verifiedByUserId = update.verifiedByUser.connect.id;
          delete update.verifiedByUser;
        }
        Object.assign(row, update);
        return row;
      },
    },
    membershipApplication: { async update({ where, data }) {
      const row = state.applications.find(value => value.id === where.id);
      Object.assign(row, data);
      return row;
    } },
    membership: {
      async findUnique({ where }) {
        return state.memberships.find(value => value.applicationId === where.applicationId) ?? null;
      },
      async findMany({ where }) {
        return state.memberships.filter(value => value.membershipNumber?.startsWith(where.membershipNumber.startsWith))
          .map(value => ({ membershipNumber: value.membershipNumber }));
      },
      async create({ data }) {
        if (options.failMembership) throw new Error('membership insert failed');
        if (state.memberships.some(value => value.applicationId === data.applicationId ||
          value.membershipNumber === data.membershipNumber)) throw new Error('unique membership violation');
        membershipSequence++;
        const row = { id: `membership-${membershipSequence}`, ...data };
        state.memberships.push(row);
        return row;
      },
    },
    user: { async update({ where, data }) {
      if (options.failUser) throw new Error('user update failed');
      const row = state.users.find(value => value.id === where.id);
      Object.assign(row, data);
      return row;
    } },
    notification: { async create({ data }) {
      if (options.failNotification) throw new Error('notification insert failed');
      state.notifications.push(data);
      return data;
    } },
    auditLog: { async create({ data }) {
      if (options.failAudit) throw new Error('audit insert failed');
      state.audits.push(data);
      return data;
    } },
    async $queryRaw() { state.locks++; return []; },
    async $transaction(work) {
      if (Array.isArray(work)) return Promise.all(work);
      const run = queue.then(async () => {
        const snapshot = {
          users: state.users.map(row => ({ ...row })),
          applications: state.applications.map(row => ({ ...row })),
          payments: state.payments.map(row => ({ ...row })),
          memberships: state.memberships.map(row => ({ ...row })),
          audits: [...state.audits], notifications: [...state.notifications], reviews: [...state.reviews],
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
  return { state, storage, service: new ReviewerPaymentsService({ client }, storage) };
}

function context(request, handler = ReviewerPaymentsController.prototype.list) {
  return { switchToHttp: () => ({ getRequest: () => request }), getHandler: () => handler,
    getClass: () => ReviewerPaymentsController };
}

async function seedReceipt(storage) {
  const target = await storage.createUploadTarget({ objectKey: receiptKey, contentType: 'application/pdf',
    contentLength: 100, expiresInSeconds: 300, context: {} });
  storage.completeUpload(target.uploadToken);
  await storage.confirmUpload(target.uploadToken);
}

test('payment reviewer routes enforce JWT, ACTIVE, and exact TREASURER/SYSTEM_ADMINISTRATOR roles', async () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, ReviewerPaymentsController),
    [SupabaseJwtGuard, ActiveAccountGuard, RolesGuard]);
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, ReviewerPaymentsController), verifierRoles);
  const guard = new RolesGuard(new Reflector());
  for (const role of verifierRoles) assert.equal(guard.canActivate(context({ principal: principal({ role }) })), true);
  for (const role of deniedRoles) {
    assert.throws(() => guard.canActivate(context({ principal: principal({ role }) })),
      error => error.getStatus() === 403);
  }
  for (const accountStatus of ['SUSPENDED', 'DISABLED', null]) {
    assert.throws(() => guard.canActivate(context({ principal: principal({ accountStatus }) })),
      error => error.getStatus() === 403);
  }
  const jwt = new SupabaseJwtGuard({ verifyAccessToken: async () => null }, { resolve: async () => ({}) });
  await assert.rejects(jwt.canActivate(context({ headers: {} })), error => error.getStatus() === 401);
});

test('payment queue/detail are searchable, paginated safe projections and receipt download is private', async () => {
  const database = reviewerDatabase();
  const page = await database.service.list({ status: 'SUBMITTED', search: 'Applicant Profile', page: '1' });
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].applicationNumber, 'MYAIS-APP-2026-000001');
  assert.equal(page.items[0].totalAmount, '150');
  const detail = await database.service.detail(paymentId);
  assert.equal(detail.applicant.displayName, 'Applicant Profile');
  assert.equal(detail.receiptDownloadAvailable, true);
  const serialized = JSON.stringify({ page, detail });
  for (const hidden of ['receiptObjectKey', 'receiptUrl', 'verifiedByUserId', 'userId', 'applicationId',
    'https://legacy.example']) assert(!serialized.includes(hidden));
  await seedReceipt(database.storage);
  assert.match((await database.service.downloadReceipt(paymentId)).downloadUrl, /^memory-private-download:/);
  database.state.payments[0].receiptObjectKey = null;
  await assert.rejects(database.service.downloadReceipt(paymentId), error => error.getStatus() === 409);
});

test('normal verification creates exact active membership, role, audit, and notification once', async () => {
  const database = reviewerDatabase();
  const result = await database.service.verify(principal(), paymentId, { treasurerRemarks: 'Verified manually' });
  assert.equal(result.status, 'VERIFIED');
  assert.equal(database.state.payments[0].verifiedByUserId, verifierId);
  assert(database.state.payments[0].verifiedAt instanceof Date);
  assert.equal(database.state.payments[0].treasurerRemarks, 'Verified manually');
  assert.equal(database.state.payments[0].membershipId, null);
  assert.equal(database.state.applications[0].status, 'ACTIVE');
  assert.equal(database.state.users[0].role, UserRole.ORDINARY_MEMBER);
  const membership = database.state.memberships[0];
  assert.match(membership.membershipNumber, /^MYAIS-\d{4}-\d{6}$/);
  assert.equal(membership.userId, applicantId);
  assert.equal(membership.applicationId, applicationId);
  assert.equal(membership.membershipTypeId, typeId);
  assert.equal(membership.membershipTypeCode, 'ORDINARY');
  assert.equal(membership.status, 'ACTIVE');
  assert.equal(membership.votingEligible, true);
  assert.equal(membership.startDate.toISOString().slice(0, 10), paymentBusinessDate(membership.activatedAt));
  assert.equal(membership.expiryDate.toISOString().slice(0, 10),
    paymentMembershipExpiry(paymentBusinessDate(membership.activatedAt), 12));
  assert.deepEqual(database.state.audits, [{ actorUserId: verifierId, actorName: 'Treasurer Name',
    action: 'PAYMENT_VERIFY', entityType: 'Payment',
    description: 'Payment MYAIS-PAY-2026-000001 verified. Remarks: Verified manually' }]);
  assert.deepEqual(database.state.notifications, [{ userId: applicantId, title: 'Payment Verified',
    message: 'Your payment has been verified successfully.', type: 'PAYMENT', eventType: 'PAYMENT_VERIFIED',
    relatedEntityType: 'Payment', actionUrl: '/my-application/payment' },
  { userId: applicantId, title: 'Membership Activated!',
    message: `Your Ordinary Member membership (${membership.membershipNumber}) is now active. ` +
      'View your digital membership card.',
    type: 'MEMBERSHIP', eventType: 'MEMBERSHIP_ACTIVATED', relatedEntityType: 'Membership', actionUrl: '/my-card' }]);
  assert.equal(database.state.reviews.length, 0);

  const repeated = await database.service.verify(principal(), paymentId, {});
  assert.equal(repeated.alreadyVerified, true);
  assert.equal(database.state.memberships.length, 1);
  assert.equal(database.state.audits.length, 1);
  assert.equal(database.state.notifications.length, 2);
});

test('verification accepts legacy UNDER_VERIFICATION pair and maps all normal canonical roles', async () => {
  for (const [code, role] of [
    ['ORDINARY', UserRole.ORDINARY_MEMBER],
    ['LIFETIME', UserRole.LIFETIME_MEMBER],
    ['ASSOCIATE', UserRole.ASSOCIATE_MEMBER],
  ]) {
    const database = reviewerDatabase({
      applications: [application({ status: 'PAYMENT_UNDER_VERIFICATION', approvedMembershipTypeCode: code })],
      payments: [payment({ status: 'UNDER_VERIFICATION' })],
      types: [membershipType(code)],
    });
    await database.service.verify(principal({ role: UserRole.SYSTEM_ADMINISTRATOR }), paymentId, {});
    assert.equal(database.state.users[0].role, role);
  }
  const unknown = reviewerDatabase({ types: [membershipType('UNKNOWN')] });
  await assert.rejects(unknown.service.verify(principal(), paymentId, {}), error => error.getStatus() === 409);
  assert.equal(unknown.state.payments[0].status, 'SUBMITTED');
});

test('Malaysia business dates and month rollover/null expiry are deterministic', () => {
  const before = new Date('2025-12-31T15:59:59.999Z');
  const after = new Date('2025-12-31T16:00:00.000Z');
  assert.equal(paymentBusinessDate(before), '2025-12-31');
  assert.equal(paymentBusinessDate(after), '2026-01-01');
  assert.equal(myaisBusinessYear(before), 2025);
  assert.equal(myaisBusinessYear(after), 2026);
  assert.equal(paymentMembershipExpiry('2026-01-31', 1), '2026-03-03');
  assert.equal(paymentMembershipExpiry('2024-01-31', 1), '2024-03-02');
  assert.equal(paymentMembershipExpiry('2026-01-01', 0), null);
  assert.equal(paymentMembershipExpiry('2026-01-01', -1), null);
});

test('self-verification/rejection and invalid source relationships are rejected for both verifier roles', async () => {
  for (const role of verifierRoles) {
    const self = reviewerDatabase();
    const verifier = principal({ id: applicantId, role });
    await assert.rejects(self.service.verify(verifier, paymentId, {}), error => error.getStatus() === 403);
    await assert.rejects(self.service.reject(verifier, paymentId, { remarks: 'No' }),
      error => error.getStatus() === 403);
  }
  const invalid = reviewerDatabase({ applications: [application({ status: 'APPROVED_PENDING_PAYMENT' })] });
  await assert.rejects(invalid.service.verify(principal(), paymentId, {}), error => error.getStatus() === 409);
  await assert.rejects(invalid.service.reject(principal(), paymentId, { remarks: 'No' }),
    error => error.getStatus() === 409);
});

test('rejection preserves exact transition, audit, notification, and no membership/role mutation', async () => {
  for (const [paymentStatus, applicationStatus] of [
    ['SUBMITTED', 'PAYMENT_SUBMITTED'],
    ['UNDER_VERIFICATION', 'PAYMENT_UNDER_VERIFICATION'],
  ]) {
    const database = reviewerDatabase({
      applications: [application({ status: applicationStatus })],
      payments: [payment({ status: paymentStatus })],
    });
    await database.service.reject(principal(), paymentId, { remarks: 'Receipt unclear' });
    assert.equal(database.state.payments[0].status, 'REJECTED');
    assert.equal(database.state.payments[0].rejectionReason, 'Receipt unclear');
    assert.equal(database.state.payments[0].treasurerRemarks, 'Receipt unclear');
    assert.equal(database.state.applications[0].status, 'APPROVED_PENDING_PAYMENT');
    assert.equal(database.state.memberships.length, 0);
    assert.equal(database.state.users[0].role, UserRole.APPLICANT);
    assert.deepEqual(database.state.audits, [{ actorUserId: verifierId, actorName: 'Treasurer Name',
      action: 'PAYMENT_REJECT', entityType: 'Payment',
      description: 'Payment MYAIS-PAY-2026-000001 rejected. Remarks: Receipt unclear' }]);
    assert.deepEqual(database.state.notifications, [{ userId: applicantId, title: 'Payment Rejected',
      message: 'Your payment has been rejected. Reason: Receipt unclear. Please submit a new receipt.',
      type: 'PAYMENT', eventType: 'PAYMENT_REJECTED', actionUrl: '/my-application/payment' }]);
  }
  await assert.rejects(reviewerDatabase().service.reject(principal(), paymentId, { remarks: '   ' }),
    error => error.getStatus() === 400);
});

test('concurrent verification and verify/reject races produce one terminal side-effect set', async () => {
  const verifyDatabase = reviewerDatabase();
  const verified = await Promise.all([
    verifyDatabase.service.verify(principal(), paymentId, {}),
    verifyDatabase.service.verify(principal(), paymentId, {}),
  ]);
  assert.equal(verified.filter(result => result.alreadyVerified).length, 1);
  assert.equal(verifyDatabase.state.memberships.length, 1);
  assert.equal(verifyDatabase.state.audits.length, 1);
  assert.equal(verifyDatabase.state.notifications.length, 2);

  const raceDatabase = reviewerDatabase();
  const results = await Promise.allSettled([
    raceDatabase.service.verify(principal(), paymentId, {}),
    raceDatabase.service.reject(principal(), paymentId, { remarks: 'Reject' }),
  ]);
  assert.deepEqual(results.map(result => result.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(raceDatabase.state.audits.length, 1);
  assert.equal(raceDatabase.state.notifications.length, 2);
});

test('membership, role, audit, and notification failures roll verification back completely', async () => {
  for (const options of [
    { failMembership: true, message: /membership insert failed/ },
    { failUser: true, message: /user update failed/ },
    { failAudit: true, message: /audit insert failed/ },
    { failNotification: true, message: /notification insert failed/ },
  ]) {
    const database = reviewerDatabase(options);
    await assert.rejects(database.service.verify(principal(), paymentId, {}), options.message);
    assert.equal(database.state.payments[0].status, 'SUBMITTED');
    assert.equal(database.state.applications[0].status, 'PAYMENT_SUBMITTED');
    assert.equal(database.state.memberships.length, 0);
    assert.equal(database.state.users[0].role, UserRole.APPLICANT);
    assert.equal(database.state.audits.length, 0);
    assert.equal(database.state.notifications.length, 0);
  }
});
