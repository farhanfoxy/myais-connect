import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@myais/database';
import { ActiveAccountGuard } from '../dist/auth/active-account.guard.js';
import { ROLES_KEY } from '../dist/auth/roles.decorator.js';
import { RolesGuard } from '../dist/auth/roles.guard.js';
import { SupabaseJwtGuard } from '../dist/auth/supabase-jwt.guard.js';
import { ReviewerApplicationsController } from '../dist/reviewer-applications/reviewer-applications.controller.js';
import { ReviewerApplicationsService } from '../dist/reviewer-applications/reviewer-applications.service.js';

const reviewerId = '111e4567-e89b-42d3-a456-426614174000';
const applicantId = '111e4567-e89b-42d3-a456-426614174001';
const secondApplicantId = '111e4567-e89b-42d3-a456-426614174002';
const applicationId = '222e4567-e89b-42d3-a456-426614174000';
const secondApplicationId = '222e4567-e89b-42d3-a456-426614174001';
const selfApplicationId = '222e4567-e89b-42d3-a456-426614174002';
const documentId = '333e4567-e89b-42d3-a456-426614174000';

const reviewerRoles = [
  UserRole.PRESIDENT,
  UserRole.DEPUTY_PRESIDENT,
  UserRole.SECRETARY,
  UserRole.ASSISTANT_SECRETARY,
  UserRole.COMMITTEE_MEMBER,
  UserRole.SYSTEM_ADMINISTRATOR,
];

function principal(overrides = {}) {
  return { id: reviewerId, email: 'reviewer@example.test', fullName: 'Reviewer Name',
    role: UserRole.SECRETARY, accountStatus: 'ACTIVE', ...overrides };
}

function user(id, overrides = {}) {
  return { id, email: `${id === applicantId ? 'alpha' : 'beta'}@example.test`, fullName: 'User Fallback',
    legacyFullName: 'Legacy Name', memberProfileByUser: {
      fullName: id === applicantId ? 'Alpha Applicant' : 'Beta Applicant', nationality: 'Malaysian',
      dateOfBirth: new Date('1990-01-02T00:00:00Z'), institution: 'Institution', aisMember: true,
      aisMembershipNumber: 'AIS-1', aisMembershipExpiry: new Date('2030-01-02T00:00:00Z'),
    }, ...overrides };
}

function application(overrides = {}) {
  return { id: applicationId, userId: applicantId, applicationNumber: 'MYAIS-APP-2026-000001',
    status: 'SUBMITTED', requestedMembershipTypeCode: 'ORDINARY', recommendedMembershipTypeCode: 'ORDINARY',
    eligibilityScore: 100, eligibilityExplanation: 'Eligible', latestReviewerRemarks: 'Earlier remark',
    rejectionReason: null, submittedAt: new Date('2026-01-02T00:00:00Z'), reviewedAt: null,
    approvedAt: null, rejectedAt: null, createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'), ...overrides };
}

function reviewDatabase(options = {}) {
  const state = {
    users: options.users ?? [user(applicantId), user(secondApplicantId),
      user(reviewerId, { email: 'reviewer@example.test', fullName: 'Reviewer Name', memberProfileByUser: null })],
    applications: options.applications ?? [application()],
    documents: options.documents ?? [{ id: documentId, applicationId, userId: applicantId,
      documentType: 'IDENTIFICATION', originalFileName: 'identity.pdf', mimeType: 'application/pdf', fileSize: 100,
      verificationStatus: 'PENDING', reviewerRemarks: 'Source-backed document remark', verifiedAt: null,
      storageObjectKey: `applications/${applicationId}/opaque`, fileUrl: 'https://legacy.example/private',
      legacyBase44Id: 'private-document-id', createdAt: new Date('2026-01-03T00:00:00Z') }],
    reviews: options.reviews ?? [], informationRequests: [], audits: [], notifications: [],
    payments: [], memberships: [], locks: 0,
  };
  let reviewSequence = 0;
  let requestSequence = 0;
  let queue = Promise.resolve();
  const related = row => {
    const recordUser = state.users.find(value => value.id === row.userId);
    return { ...row, user: recordUser,
      requestedMembershipType: row.requestedMembershipTypeCode
        ? { name: `${row.requestedMembershipTypeCode} Member` } : null,
      recommendedMembershipType: row.recommendedMembershipTypeCode
        ? { name: `${row.recommendedMembershipTypeCode} Member` } : null,
      applicationDocumentRecordsByApplication: state.documents.filter(value => value.applicationId === row.id)
        .sort((left, right) => left.createdAt - right.createdAt),
      applicationReviewRecordsByApplication: state.reviews.filter(value => value.applicationId === row.id)
        .sort((left, right) => right.createdAt - left.createdAt),
    };
  };
  const matchesWhere = (row, where) => {
    if (where.status && row.status !== where.status) return false;
    const search = where.OR?.[0]?.applicationNumber?.contains?.toLowerCase();
    if (!search) return true;
    const recordUser = state.users.find(value => value.id === row.userId);
    return [row.applicationNumber, recordUser?.email, recordUser?.fullName, recordUser?.legacyFullName,
      recordUser?.memberProfileByUser?.fullName].some(value => value?.toLowerCase().includes(search));
  };
  const client = {
    membershipApplication: {
      async findMany({ where, skip = 0, take = 15 }) {
        return state.applications.filter(row => matchesWhere(row, where))
          .sort((left, right) => right.createdAt - left.createdAt || right.id.localeCompare(left.id))
          .slice(skip, skip + take).map(related);
      },
      async count({ where }) { return state.applications.filter(row => matchesWhere(row, where)).length; },
      async findUnique({ where }) {
        const row = state.applications.find(value => value.id === where.id);
        return row ? related(row) : null;
      },
      async update({ where, data }) {
        const row = state.applications.find(value => value.id === where.id);
        const update = { ...data };
        if (update.reviewedByUser) {
          update.reviewedByUserId = update.reviewedByUser.connect.id;
          delete update.reviewedByUser;
        }
        Object.assign(row, update, { updatedAt: new Date() });
        return row;
      },
    },
    applicationDocument: {
      async findFirst({ where }) {
        const row = state.documents.find(value => value.id === where.id && value.applicationId === where.applicationId);
        return row ? { storageObjectKey: row.storageObjectKey } : null;
      },
    },
    informationRequest: { async create({ data }) {
      requestSequence++;
      const row = { id: `444e4567-e89b-42d3-a456-42661417400${requestSequence}`,
        createdAt: new Date(), ...data };
      state.informationRequests.push(row); return row;
    } },
    applicationReview: { async create({ data }) {
      reviewSequence++;
      const row = { id: `555e4567-e89b-42d3-a456-42661417400${reviewSequence}`,
        createdAt: new Date(), ...data };
      state.reviews.push(row); return row;
    } },
    auditLog: { async create({ data }) {
      if (options.failAudit) throw new Error('audit failed');
      state.audits.push(data); return data;
    } },
    notification: { async create({ data }) { state.notifications.push(data); return data; } },
    async $queryRaw() { state.locks++; return []; },
    async $transaction(work) {
      if (Array.isArray(work)) return Promise.all(work);
      const run = queue.then(async () => {
        const snapshot = globalThis.structuredClone(state);
        try { return await work(client); }
        catch (error) {
          const locks = state.locks;
          Object.assign(state, snapshot);
          state.locks = locks;
          throw error;
        }
      });
      queue = run.catch(() => undefined);
      return run;
    },
  };
  const storage = { async createDownloadTarget(key, expiresInSeconds) {
    assert.equal(key, `applications/${applicationId}/opaque`);
    assert.equal(expiresInSeconds, 300);
    return { downloadUrl: 'private://signed', expiresAt: new Date(Date.now() + 300000).toISOString() };
  } };
  return { state, service: new ReviewerApplicationsService({ client }, storage) };
}

function context(request, handler = ReviewerApplicationsController.prototype.list) {
  return { switchToHttp: () => ({ getRequest: () => request }), getHandler: () => handler,
    getClass: () => ReviewerApplicationsController };
}

test('reviewer routes enforce JWT, ACTIVE, and the six exact canonical reviewer roles', async () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, ReviewerApplicationsController),
    [SupabaseJwtGuard, ActiveAccountGuard, RolesGuard]);
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, ReviewerApplicationsController), reviewerRoles);
  const guard = new RolesGuard(new Reflector());
  for (const role of reviewerRoles) {
    assert.equal(guard.canActivate(context({ principal: principal({ role }) })), true);
  }
  for (const role of [UserRole.TREASURER, UserRole.APPLICANT, UserRole.ORDINARY_MEMBER,
    UserRole.LIFETIME_MEMBER, UserRole.ASSOCIATE_MEMBER, UserRole.HONORARY_MEMBER]) {
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

test('controller derives mutation actor from CurrentUser principal', async () => {
  let actor;
  const controller = new ReviewerApplicationsController({
    startReview: async reviewer => { actor = reviewer; return {}; },
  });
  const reviewer = principal();
  await controller.startReview(reviewer, applicationId, {});
  assert.equal(actor, reviewer);
});

test('queue is newest-first with status/search/pagination and a safe projection', async () => {
  const applications = [
    application(),
    application({ id: secondApplicationId, userId: secondApplicantId,
      applicationNumber: 'MYAIS-APP-2026-000002', status: 'UNDER_REVIEW',
      createdAt: new Date('2026-02-01T00:00:00Z') }),
    application({ id: selfApplicationId, applicationNumber: null, status: 'DRAFT',
      createdAt: new Date('2025-12-01T00:00:00Z') }),
  ];
  const database = reviewDatabase({ applications });
  const page = await database.service.list({ page: '1', pageSize: '2', status: 'ALL', search: '' });
  assert.deepEqual(page.items.map(row => row.id), [secondApplicationId, applicationId]);
  assert.deepEqual({ page: page.page, pageSize: page.pageSize, total: page.total, totalPages: page.totalPages },
    { page: 1, pageSize: 2, total: 3, totalPages: 2 });
  assert.equal((await database.service.list({ status: 'UNDER_REVIEW' })).items.length, 1);
  assert.equal((await database.service.list({ search: '000001' })).items[0].id, applicationId);
  assert.equal((await database.service.list({ search: 'Alpha Applicant' })).items[0].id, applicationId);
  assert.equal((await database.service.list({ search: 'alpha@example.test' })).items[0].id, applicationId);
  const serialized = JSON.stringify(page);
  for (const secret of ['legacyBase44Id', 'supabaseAuthUserId', 'storageObjectKey', 'fileUrl'])
    assert(!serialized.includes(secret));
  await assert.rejects(database.service.list({ page: '0' }), error => error.getStatus() === 400);
});

test('detail returns source-backed review data and omits internal IDs and legacy URLs', async () => {
  const database = reviewDatabase({ reviews: [
    { id: 'review-old', applicationId, reviewerName: 'First Reviewer', decision: 'START_REVIEW', remarks: '',
      previousStatus: 'SUBMITTED', newStatus: 'UNDER_REVIEW', reviewerUserId: 'private-reviewer-id',
      createdAt: new Date('2026-01-03T00:00:00Z'), legacyBase44Id: 'private-review-id' },
    { id: 'review-new', applicationId, reviewerName: 'Second Reviewer', decision: 'REQUEST_INFORMATION',
      remarks: 'Provide detail', previousStatus: 'UNDER_REVIEW', newStatus: 'ADDITIONAL_INFORMATION_REQUIRED',
      reviewerUserId: 'private-reviewer-id-2', createdAt: new Date('2026-01-04T00:00:00Z') },
  ] });
  const detail = await database.service.detail(applicationId);
  assert.equal(detail.applicant.displayName, 'Alpha Applicant');
  assert.equal(detail.applicant.dateOfBirth, '1990-01-02');
  assert.equal(detail.requestedMembershipType.code, 'ORDINARY');
  assert.equal(detail.eligibilityScore, 100);
  assert.equal(detail.documents[0].reviewerRemarks, 'Source-backed document remark');
  assert.deepEqual(detail.reviewHistory.map(row => row.id), ['review-new', 'review-old']);
  const serialized = JSON.stringify(detail);
  for (const secret of ['https://legacy.example', 'storageObjectKey', 'legacyBase44Id',
    'reviewerUserId', 'private-reviewer-id']) assert(!serialized.includes(secret));
});

test('reviewer document download verifies application/document relationship and never proxies legacy URLs', async () => {
  const database = reviewDatabase();
  assert.equal((await database.service.downloadDocument(applicationId, documentId)).downloadUrl, 'private://signed');
  await assert.rejects(database.service.downloadDocument(secondApplicationId, documentId),
    error => error.getStatus() === 404);
  database.state.documents[0].storageObjectKey = null;
  await assert.rejects(database.service.downloadDocument(applicationId, documentId),
    error => error.getStatus() === 409);
});

test('START_REVIEW writes transition, reviewer cache, review, and exact audit', async () => {
  const database = reviewDatabase();
  const result = await database.service.startReview(principal(), applicationId, { remarks: '' });
  assert.equal(result.status, 'UNDER_REVIEW');
  const app = database.state.applications[0];
  assert.equal(app.status, 'UNDER_REVIEW');
  assert.equal(app.reviewedByUserId, reviewerId);
  assert(app.reviewedAt instanceof Date);
  assert.equal(app.latestReviewerRemarks, 'Earlier remark');
  assert.deepEqual(database.state.reviews.map(row => ({
    applicationId: row.applicationId,
    reviewerUserId: row.reviewerUserId,
    reviewerName: row.reviewerName,
    decision: row.decision,
    remarks: row.remarks,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
  })), [{
    applicationId, reviewerUserId: reviewerId, reviewerName: 'Reviewer Name', decision: 'START_REVIEW',
    remarks: '', previousStatus: 'SUBMITTED', newStatus: 'UNDER_REVIEW',
  }]);
  assert.deepEqual(database.state.audits, [{ actorUserId: reviewerId, actorName: 'Reviewer Name',
    action: 'APPLICATION_START_REVIEW', entityType: 'MembershipApplication',
    description: 'START REVIEW on MYAIS-APP-2026-000001. Remarks: ' }]);
});

test('REQUEST_INFORMATION requires remarks, supports due date, and creates no notification', async () => {
  const database = reviewDatabase({ applications: [application({ status: 'UNDER_REVIEW' })] });
  await assert.rejects(database.service.requestInformation(principal(), applicationId, { remarks: '   ' }),
    error => error.getStatus() === 400);
  const result = await database.service.requestInformation(principal(), applicationId,
    { remarks: 'Please provide evidence', dueDate: '2026-03-31' });
  assert.equal(result.status, 'ADDITIONAL_INFORMATION_REQUIRED');
  assert.equal(database.state.informationRequests.length, 1);
  assert.deepEqual({ ...database.state.informationRequests[0], id: undefined, createdAt: undefined }, {
    id: undefined, createdAt: undefined, applicationId, requestedByUserId: reviewerId,
    requestedByName: 'Reviewer Name', message: 'Please provide evidence',
    dueDate: new Date('2026-03-31T00:00:00Z'), status: 'OPEN',
  });
  assert.equal(database.state.reviews[0].decision, 'REQUEST_INFORMATION');
  assert.equal(database.state.audits[0].action, 'APPLICATION_REQUEST_INFORMATION');
  assert.equal(database.state.notifications.length, 0);
});

test('RECOMMEND_APPROVAL changes only review state and creates no payment, membership, or notification', async () => {
  const database = reviewDatabase({ applications: [application({ status: 'UNDER_REVIEW' })] });
  const before = { eligibilityScore: database.state.applications[0].eligibilityScore,
    requestedMembershipTypeCode: database.state.applications[0].requestedMembershipTypeCode,
    recommendedMembershipTypeCode: database.state.applications[0].recommendedMembershipTypeCode };
  await database.service.recommendApproval(principal(), applicationId, { remarks: '' });
  assert.equal(database.state.applications[0].status, 'RECOMMENDED_FOR_APPROVAL');
  assert.equal(database.state.applications[0].latestReviewerRemarks, 'Earlier remark');
  assert.deepEqual({ eligibilityScore: database.state.applications[0].eligibilityScore,
    requestedMembershipTypeCode: database.state.applications[0].requestedMembershipTypeCode,
    recommendedMembershipTypeCode: database.state.applications[0].recommendedMembershipTypeCode }, before);
  assert.equal(database.state.reviews[0].decision, 'RECOMMEND_APPROVAL');
  assert.equal(database.state.audits[0].action, 'APPLICATION_RECOMMEND_APPROVAL');
  assert.equal(database.state.payments.length, 0);
  assert.equal(database.state.memberships.length, 0);
  assert.equal(database.state.notifications.length, 0);
});

test('REJECT works from both source statuses with exact reason, review, audit, and notification', async () => {
  for (const status of ['UNDER_REVIEW', 'RECOMMENDED_FOR_APPROVAL']) {
    const database = reviewDatabase({ applications: [application({ status })] });
    await database.service.reject(principal(), applicationId, { remarks: 'Insufficient evidence' });
    const app = database.state.applications[0];
    assert.equal(app.status, 'REJECTED');
    assert.equal(app.rejectionReason, 'Insufficient evidence');
    assert(app.rejectedAt instanceof Date);
    assert.equal(database.state.reviews[0].previousStatus, status);
    assert.equal(database.state.reviews[0].decision, 'REJECT');
    assert.equal(database.state.audits[0].action, 'APPLICATION_REJECT');
    assert.deepEqual(database.state.notifications, [{ userId: applicantId, title: 'Application Rejected',
      message: 'Your membership application has been rejected. Reason: Insufficient evidence',
      type: 'APPLICATION', relatedEntityType: 'MembershipApplication', actionUrl: '/my-application/tracker' }]);
  }
  await assert.rejects(reviewDatabase({ applications: [application({ status: 'UNDER_REVIEW' })] }).service
    .reject(principal(), applicationId, { remarks: '' }), error => error.getStatus() === 400);
});

test('mutations reject self-review, invalid source state, and client-controlled canonical fields', async () => {
  const self = reviewDatabase({ applications: [application({ userId: reviewerId })] });
  await assert.rejects(self.service.startReview(principal(), applicationId, {}),
    error => error.getStatus() === 403);
  await assert.rejects(self.service.startReview(principal({ role: UserRole.SYSTEM_ADMINISTRATOR }), applicationId, {}),
    error => error.getStatus() === 403);
  await assert.rejects(reviewDatabase().service.recommendApproval(principal(), applicationId, {}),
    error => error.getStatus() === 409);
  for (const forbidden of [{ reviewerUserId: secondApplicantId }, { actorName: 'Forged' },
    { status: 'UNDER_REVIEW' }, { reviewedAt: '2026-01-01T00:00:00Z' },
    { rejectedAt: '2026-01-01T00:00:00Z' }, { decision: 'APPROVE' }]) {
    await assert.rejects(reviewDatabase().service.startReview(principal(), applicationId, forbidden),
      error => error.getStatus() === 400);
  }
});

test('application lock permits only one concurrent transition and one review/audit row', async () => {
  const database = reviewDatabase();
  const results = await Promise.allSettled([
    database.service.startReview(principal(), applicationId, {}),
    database.service.startReview(principal(), applicationId, {}),
  ]);
  assert.deepEqual(results.map(result => result.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(results.find(result => result.status === 'rejected').reason.getStatus(), 409);
  assert.equal(database.state.reviews.length, 1);
  assert.equal(database.state.audits.length, 1);
  assert.equal(database.state.locks, 2);
});

test('transaction failure rolls application and all side effects back', async () => {
  const database = reviewDatabase({ failAudit: true });
  await assert.rejects(database.service.startReview(principal(), applicationId, {}), /audit failed/);
  assert.equal(database.state.applications[0].status, 'SUBMITTED');
  assert.equal(database.state.reviews.length, 0);
  assert.equal(database.state.audits.length, 0);
});
