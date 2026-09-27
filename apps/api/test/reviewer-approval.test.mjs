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
import { ReviewerApplicationsController } from '../dist/reviewer-applications/reviewer-applications.controller.js';
import {
  myaisBusinessDate,
  ReviewerApplicationsService,
} from '../dist/reviewer-applications/reviewer-applications.service.js';

const presidentId = '111e4567-e89b-42d3-a456-426614174000';
const systemAdministratorId = '111e4567-e89b-42d3-a456-426614174001';
const applicantId = '111e4567-e89b-42d3-a456-426614174002';
const secondApplicantId = '111e4567-e89b-42d3-a456-426614174003';
const applicationId = '222e4567-e89b-42d3-a456-426614174000';
const secondApplicationId = '222e4567-e89b-42d3-a456-426614174001';
const ordinaryTypeId = '333e4567-e89b-42d3-a456-426614174000';
const honoraryTypeId = '333e4567-e89b-42d3-a456-426614174001';
const inactiveTypeId = '333e4567-e89b-42d3-a456-426614174002';
const lifetimeTypeId = '333e4567-e89b-42d3-a456-426614174003';

const approvalRoles = [UserRole.PRESIDENT, UserRole.SYSTEM_ADMINISTRATOR];
const deniedRoles = [
  UserRole.DEPUTY_PRESIDENT,
  UserRole.SECRETARY,
  UserRole.ASSISTANT_SECRETARY,
  UserRole.COMMITTEE_MEMBER,
  UserRole.TREASURER,
  UserRole.APPLICANT,
  UserRole.ORDINARY_MEMBER,
  UserRole.LIFETIME_MEMBER,
  UserRole.ASSOCIATE_MEMBER,
  UserRole.HONORARY_MEMBER,
];

function principal(overrides = {}) {
  return {
    id: presidentId,
    email: 'president@example.test',
    fullName: 'President Name',
    role: UserRole.PRESIDENT,
    accountStatus: 'ACTIVE',
    ...overrides,
  };
}

function application(overrides = {}) {
  return {
    id: applicationId,
    userId: applicantId,
    applicationNumber: 'MYAIS-APP-2026-000001',
    status: 'RECOMMENDED_FOR_APPROVAL',
    latestReviewerRemarks: 'Earlier recommendation',
    approvedMembershipTypeId: null,
    approvedMembershipTypeCode: null,
    approvedAt: null,
    approvedByUserId: null,
    reviewedByUserId: null,
    reviewedAt: null,
    ...overrides,
  };
}

function type(id, code, overrides = {}) {
  return {
    id,
    code,
    name: `${code[0]}${code.slice(1).toLowerCase()} Member`,
    entranceFee: new Prisma.Decimal(code === 'HONORARY' ? 0 : 100),
    membershipFee: new Prisma.Decimal(code === 'HONORARY' ? 0 : 50),
    votingRights: code !== 'ASSOCIATE',
    applicantSelectable: false,
    active: true,
    ...overrides,
  };
}

function approvalDatabase(options = {}) {
  const state = {
    applications: options.applications ?? [application()],
    users: [{ id: applicantId, role: UserRole.APPLICANT },
      { id: secondApplicantId, role: UserRole.APPLICANT }],
    types: options.types ?? [
      type(ordinaryTypeId, 'ORDINARY'),
      type(honoraryTypeId, 'HONORARY'),
      type(inactiveTypeId, 'ASSOCIATE', { active: false }),
      type(lifetimeTypeId, 'LIFETIME'),
    ],
    payments: options.payments ?? [],
    memberships: options.memberships ?? [],
    reviews: [],
    audits: [],
    notifications: [],
    locks: [],
  };
  let queue = Promise.resolve();
  const client = {
    membershipApplication: {
      async findUnique({ where }) {
        const row = state.applications.find(value => value.id === where.id);
        return row ? { ...row } : null;
      },
      async update({ where, data }) {
        const row = state.applications.find(value => value.id === where.id);
        const update = { ...data };
        for (const [relation, field] of [
          ['approvedMembershipType', 'approvedMembershipTypeId'],
          ['approvedByUser', 'approvedByUserId'],
          ['reviewedByUser', 'reviewedByUserId'],
        ]) {
          if (update[relation]) {
            update[field] = update[relation].connect.id;
            delete update[relation];
          }
        }
        Object.assign(row, update);
        return row;
      },
    },
    membershipType: {
      async findUnique({ where }) { return state.types.find(row => row.id === where.id) ?? null; },
    },
    payment: {
      async findMany({ where }) {
        return state.payments.filter(row => row.paymentReference?.startsWith(where.paymentReference.startsWith))
          .map(row => ({ paymentReference: row.paymentReference }));
      },
      async create({ data }) {
        if (options.failPayment) throw new Error('payment insert failed');
        if (state.payments.some(row => row.applicationId === data.applicationId ||
          row.paymentReference === data.paymentReference)) throw new Error('unique payment violation');
        const row = { id: `payment-${state.payments.length + 1}`, ...data };
        state.payments.push(row);
        return row;
      },
    },
    membership: {
      async findMany({ where }) {
        return state.memberships.filter(row => row.membershipNumber?.startsWith(where.membershipNumber.startsWith))
          .map(row => ({ membershipNumber: row.membershipNumber }));
      },
      async create({ data }) {
        if (options.failMembership) throw new Error('membership insert failed');
        if (state.memberships.some(row => row.applicationId === data.applicationId ||
          row.membershipNumber === data.membershipNumber)) throw new Error('unique membership violation');
        const row = { id: `membership-${state.memberships.length + 1}`, ...data };
        state.memberships.push(row);
        return row;
      },
    },
    applicationReview: { async create({ data }) { state.reviews.push(data); return data; } },
    auditLog: { async create({ data }) {
      if (options.failAudit) throw new Error('audit insert failed');
      state.audits.push(data);
      return data;
    } },
    notification: { async create({ data }) { state.notifications.push(data); return data; } },
    async $queryRaw(_strings, value) { state.locks.push(value); return []; },
    async $transaction(work) {
      const run = queue.then(async () => {
        const snapshot = {
          applications: state.applications.map(row => ({ ...row })),
          payments: [...state.payments],
          memberships: [...state.memberships],
          reviews: [...state.reviews],
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
  const storage = { async createDownloadTarget() { throw new Error('not used'); } };
  return { state, service: new ReviewerApplicationsService({ client }, storage) };
}

function context(request, handler = ReviewerApplicationsController.prototype.approve) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => ReviewerApplicationsController,
  };
}

test('approval route uses existing guards and only the two canonical final-approver roles', async () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, ReviewerApplicationsController),
    [SupabaseJwtGuard, ActiveAccountGuard, RolesGuard]);
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, ReviewerApplicationsController.prototype.approve), approvalRoles);
  const guard = new RolesGuard(new Reflector());
  for (const role of approvalRoles) {
    assert.equal(guard.canActivate(context({ principal: principal({ role }) })), true);
  }
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

test('approval controller derives the approver from CurrentUser', async () => {
  let actor;
  const controller = new ReviewerApplicationsController({
    approve: async reviewer => { actor = reviewer; return {}; },
  });
  const reviewer = principal();
  await controller.approve(reviewer, applicationId, { approvedMembershipTypeId: ordinaryTypeId });
  assert.equal(actor, reviewer);
});

test('non-honorary approval persists legacy fields and exact atomic side effects', async () => {
  const database = approvalDatabase({
    payments: [{ paymentReference: `MYAIS-PAY-${myaisBusinessYear(new Date())}-000007` }],
  });
  const result = await database.service.approve(principal(), applicationId, {
    approvedMembershipTypeId: ordinaryTypeId,
    remarks: 'Approved by president',
  });
  const row = database.state.applications[0];
  assert.equal(result.status, 'APPROVED_PENDING_PAYMENT');
  assert.equal(row.status, 'APPROVED_PENDING_PAYMENT');
  assert.equal(row.approvedMembershipTypeId, ordinaryTypeId);
  assert.equal(row.approvedMembershipTypeCode, 'ORDINARY');
  assert.equal(row.approvedByUserId, presidentId);
  assert.equal(row.reviewedByUserId, presidentId);
  assert(row.approvedAt instanceof Date);
  assert.equal(row.reviewedAt, row.approvedAt);
  assert.equal(row.latestReviewerRemarks, 'Approved by president');
  const payment = database.state.payments.at(-1);
  assert.match(payment.paymentReference, /^MYAIS-PAY-\d{4}-000008$/);
  assert.equal(payment.userId, applicantId);
  assert.equal(payment.applicationId, applicationId);
  assert.equal(payment.paymentType, 'ENTRANCE_AND_ANNUAL');
  assert.equal(payment.entranceFee.toString(), '100');
  assert.equal(payment.membershipFee.toString(), '50');
  assert.equal(payment.totalAmount.toString(), '150');
  assert.equal(payment.currency, 'MYR');
  assert.equal(payment.status, 'NOT_SUBMITTED');
  assert.equal(database.state.memberships.length, 0);
  assert.equal(database.state.users[0].role, UserRole.APPLICANT);
  assert.deepEqual(database.state.reviews, [{
    applicationId,
    reviewerUserId: presidentId,
    reviewerName: 'President Name',
    decision: 'APPROVE',
    remarks: 'Approved by president',
    previousStatus: 'RECOMMENDED_FOR_APPROVAL',
    newStatus: 'APPROVED_PENDING_PAYMENT',
  }]);
  assert.deepEqual(database.state.audits, [{
    actorUserId: presidentId,
    actorName: 'President Name',
    action: 'APPLICATION_APPROVE',
    entityType: 'MembershipApplication',
    description: 'APPROVE on MYAIS-APP-2026-000001. Remarks: Approved by president',
  }]);
  assert.deepEqual(database.state.notifications, [{
    userId: applicantId,
    title: 'Application Approved!',
    message: 'Your membership application has been approved as Ordinary Member. ' +
      'Please submit your payment to activate your membership.',
    type: 'APPLICATION',
    relatedEntityType: 'MembershipApplication',
    actionUrl: '/my-application/payment',
  }]);
});

test('approval validates only existence and active state, not applicant selection, eligibility, or documents', async () => {
  const database = approvalDatabase();
  await database.service.approve(principal(), applicationId, { approvedMembershipTypeId: ordinaryTypeId });
  assert.equal(database.state.types[0].applicantSelectable, false);

  await assert.rejects(approvalDatabase().service.approve(principal(), applicationId,
    { approvedMembershipTypeId: inactiveTypeId }), error => error.getStatus() === 400);
  await assert.rejects(approvalDatabase().service.approve(principal(), applicationId,
    { approvedMembershipTypeId: '333e4567-e89b-42d3-a456-426614174099' }),
  error => error.getStatus() === 400);
  for (const input of [
    {},
    { approvedMembershipTypeId: 'not-a-uuid' },
    { approvedMembershipTypeId: ordinaryTypeId, userId: applicantId },
    { approvedMembershipTypeId: ordinaryTypeId, status: 'ACTIVE' },
    { approvedMembershipTypeId: ordinaryTypeId, paymentAmount: 1 },
    { approvedMembershipTypeId: ordinaryTypeId, approvedByUserId: applicantId },
  ]) {
    await assert.rejects(approvalDatabase().service.approve(principal(), applicationId, input),
      error => error.getStatus() === 400);
  }
});

test('lifetime approval preserves the Base44 entrance-and-lifetime payment category', async () => {
  const database = approvalDatabase();
  await database.service.approve(principal(), applicationId, { approvedMembershipTypeId: lifetimeTypeId });
  assert.equal(database.state.payments[0].paymentType, 'ENTRANCE_AND_LIFETIME');
  assert.equal(database.state.payments[0].status, 'NOT_SUBMITTED');
});

test('honorary approval creates the source-backed verified payment and active membership only', async () => {
  const year = myaisBusinessYear(new Date());
  const database = approvalDatabase({
    payments: [{ paymentReference: `MYAIS-PAY-${year}-000003` }],
    memberships: [{ membershipNumber: `MYAIS-${year}-000009` }],
  });
  const result = await database.service.approve(
    principal({ id: systemAdministratorId, role: UserRole.SYSTEM_ADMINISTRATOR,
      email: 'admin@example.test', fullName: 'System Administrator' }),
    applicationId,
    { approvedMembershipTypeId: honoraryTypeId },
  );
  assert.equal(result.status, 'ACTIVE');
  assert.match(result.paymentReference, /^MYAIS-PAY-\d{4}-000004$/);
  assert.match(result.membershipNumber, /^MYAIS-\d{4}-000010$/);
  const payment = database.state.payments.at(-1);
  assert.equal(payment.paymentType, 'OTHER');
  assert.equal(payment.status, 'VERIFIED');
  assert.equal(payment.totalAmount.toString(), '0');
  assert.equal(payment.verifiedByUserId, undefined);
  assert.equal(payment.verifiedAt, undefined);
  assert.equal(payment.membershipId, undefined);
  const membership = database.state.memberships.at(-1);
  assert.equal(membership.userId, applicantId);
  assert.equal(membership.applicationId, applicationId);
  assert.equal(membership.membershipTypeId, honoraryTypeId);
  assert.equal(membership.membershipTypeCode, 'HONORARY');
  assert.equal(membership.membershipTypeName, 'Honorary Member');
  assert.equal(membership.startDate.toISOString().slice(0, 10), myaisBusinessDate(membership.activatedAt));
  assert.equal(membership.expiryDate, undefined);
  assert.equal(membership.status, 'ACTIVE');
  assert.equal(membership.votingEligible, true);
  assert.equal(database.state.users[0].role, UserRole.APPLICANT);
  assert.equal(database.state.reviews[0].newStatus, 'ACTIVE');
  assert.deepEqual(database.state.notifications, [{
    userId: applicantId,
    title: 'Application Approved!',
    message: 'Your membership application has been approved as Honorary Member. Your membership is now active.',
    type: 'APPLICATION',
    relatedEntityType: 'MembershipApplication',
    actionUrl: '/my-card',
  }]);
});

test('business year and date use Asia/Kuala_Lumpur at the UTC New Year boundary', () => {
  const before = new Date('2025-12-31T15:59:59.999Z');
  const after = new Date('2025-12-31T16:00:00.000Z');
  assert.equal(myaisBusinessYear(before), 2025);
  assert.equal(myaisBusinessDate(before), '2025-12-31');
  assert.equal(myaisBusinessYear(after), 2026);
  assert.equal(myaisBusinessDate(after), '2026-01-01');
});

test('approval rejects invalid state, both approver self-approval cases, and non-authorized principals', async () => {
  await assert.rejects(approvalDatabase({ applications: [application({ status: 'UNDER_REVIEW' })] }).service
    .approve(principal(), applicationId, { approvedMembershipTypeId: ordinaryTypeId }),
  error => error.getStatus() === 409);
  for (const role of approvalRoles) {
    const reviewer = principal({ id: applicantId, role });
    await assert.rejects(approvalDatabase().service.approve(reviewer, applicationId,
      { approvedMembershipTypeId: ordinaryTypeId }), error => error.getStatus() === 403);
  }
  for (const reviewer of [
    principal({ role: UserRole.SECRETARY }),
    principal({ accountStatus: 'SUSPENDED' }),
  ]) {
    await assert.rejects(approvalDatabase().service.approve(reviewer, applicationId,
      { approvedMembershipTypeId: ordinaryTypeId }), error => error.getStatus() === 403);
  }
});

test('sequential and concurrent duplicate approval create exactly one financial record and side-effect set', async () => {
  for (const concurrent of [false, true]) {
    const database = approvalDatabase();
    const invoke = () => database.service.approve(principal(), applicationId,
      { approvedMembershipTypeId: ordinaryTypeId });
    if (concurrent) {
      const results = await Promise.allSettled([invoke(), invoke()]);
      assert.deepEqual(results.map(result => result.status).sort(), ['fulfilled', 'rejected']);
      assert.equal(results.find(result => result.status === 'rejected').reason.getStatus(), 409);
    } else {
      await invoke();
      await assert.rejects(invoke(), error => error.getStatus() === 409);
    }
    assert.equal(database.state.payments.length, 1);
    assert.equal(database.state.memberships.length, 0);
    assert.equal(database.state.reviews.length, 1);
    assert.equal(database.state.audits.length, 1);
    assert.equal(database.state.notifications.length, 1);
  }
});

test('concurrent honorary duplicate approval creates one payment and one membership', async () => {
  const database = approvalDatabase();
  const invoke = () => database.service.approve(principal(), applicationId,
    { approvedMembershipTypeId: honoraryTypeId });
  const results = await Promise.allSettled([invoke(), invoke()]);
  assert.deepEqual(results.map(result => result.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(database.state.payments.length, 1);
  assert.equal(database.state.memberships.length, 1);
  assert.equal(database.state.reviews.length, 1);
  assert.equal(database.state.audits.length, 1);
  assert.equal(database.state.notifications.length, 1);
});

test('concurrent distinct honorary approvals allocate unique payment and membership numbers', async () => {
  const database = approvalDatabase({ applications: [
    application(),
    application({ id: secondApplicationId, userId: secondApplicantId,
      applicationNumber: 'MYAIS-APP-2026-000002' }),
  ] });
  const results = await Promise.all([
    database.service.approve(principal(), applicationId, { approvedMembershipTypeId: honoraryTypeId }),
    database.service.approve(principal(), secondApplicationId, { approvedMembershipTypeId: honoraryTypeId }),
  ]);
  assert.equal(new Set(results.map(result => result.paymentReference)).size, 2);
  assert.equal(new Set(results.map(result => result.membershipNumber)).size, 2);
  assert.equal(database.state.payments.length, 2);
  assert.equal(database.state.memberships.length, 2);
});

test('payment, membership, and final side-effect failures roll the whole approval back', async () => {
  for (const options of [
    { failPayment: true, typeId: ordinaryTypeId, message: /payment insert failed/ },
    { failMembership: true, typeId: honoraryTypeId, message: /membership insert failed/ },
    { failAudit: true, typeId: honoraryTypeId, message: /audit insert failed/ },
  ]) {
    const database = approvalDatabase(options);
    await assert.rejects(database.service.approve(principal(), applicationId,
      { approvedMembershipTypeId: options.typeId }), options.message);
    assert.equal(database.state.applications[0].status, 'RECOMMENDED_FOR_APPROVAL');
    assert.equal(database.state.payments.length, 0);
    assert.equal(database.state.memberships.length, 0);
    assert.equal(database.state.reviews.length, 0);
    assert.equal(database.state.audits.length, 0);
    assert.equal(database.state.notifications.length, 0);
  }
});
