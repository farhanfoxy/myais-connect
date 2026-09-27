import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { ActiveAccountGuard } from '../dist/auth/active-account.guard.js';
import { SupabaseJwtGuard } from '../dist/auth/supabase-jwt.guard.js';
import { EligibilityController } from '../dist/eligibility/eligibility.controller.js';
import { EligibilityService, evaluateLegacyEligibility } from '../dist/eligibility/eligibility.service.js';
import { MembershipApplicationsController } from '../dist/membership-applications/membership-applications.controller.js';
import { MembershipApplicationsService } from '../dist/membership-applications/membership-applications.service.js';

const ownId = '111e4567-e89b-42d3-a456-426614174000';
const otherId = '111e4567-e89b-42d3-a456-426614174001';
const applicationId = '222e4567-e89b-42d3-a456-426614174000';
const now = new Date('2026-01-01T00:00:00.000Z');

function passingProfile(overrides = {}) {
  return { nationality: 'Malaysian', dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
    country: 'Malaysia', aisMember: true, aisMembershipExpiry: new Date('2030-01-02T00:00:00.000Z'),
    ...overrides };
}

function evaluate(profile = passingProfile(), answers = {}) {
  return evaluateLegacyEligibility(profile, answers, now);
}

test('legacy eligibility passes all five conditions for ORDINARY/LIFETIME at score 100', () => {
  assert.deepEqual(evaluate(), {
    recommendedTypeCode: 'ORDINARY',
    recommendedTypeName: 'Ordinary Member',
    explanation: 'All requirements satisfied. You are eligible for Ordinary or Lifetime membership.',
    score: 100,
    selectableTypeCodes: ['ORDINARY', 'LIFETIME'],
  });
});

test('each failed condition subtracts 20; multiple failures floor score at zero and select ASSOCIATE', () => {
  const failures = [
    { nationality: null },
    { dateOfBirth: new Date('2010-01-01T00:00:00.000Z') },
    { country: null },
    { aisMember: false },
    { aisMembershipExpiry: now },
  ];
  for (const failure of failures) {
    const result = evaluate(passingProfile(failure));
    assert.equal(result.score, 80);
    assert.equal(result.recommendedTypeCode, 'ASSOCIATE');
    assert.deepEqual(result.selectableTypeCodes, ['ASSOCIATE']);
  }
  const failed = evaluate({ nationality: null, dateOfBirth: null, country: null, aisMember: false,
    aisMembershipExpiry: null });
  assert.equal(failed.score, 0);
  assert.match(failed.explanation, /^Associate membership recommended\. Issues:/);
});

test('AIS expiry must be strictly later than now and AIS number never affects eligibility', () => {
  assert.equal(evaluate(passingProfile({ aisMembershipExpiry: new Date('2025-12-31T23:59:59.999Z') })).score, 80);
  assert.equal(evaluate(passingProfile({ aisMembershipExpiry: now })).score, 80);
  assert.equal(evaluate(passingProfile({ aisMembershipExpiry: new Date('2026-01-01T00:00:00.001Z') })).score, 100);
  assert.deepEqual(evaluate(null, { malaysianCitizen: true, dateOfBirth: '1990-01-01',
    residingInMalaysia: true, aisMember: true, aisExpiry: '2026-01-02', aisNumber: 'AIS-1' }),
  evaluate(null, { malaysianCitizen: true, dateOfBirth: '1990-01-01', residingInMalaysia: true,
    aisMember: true, aisExpiry: '2026-01-02', aisNumber: 'DIFFERENT' }));
});

test('legacy profile/transient precedence is preserved exactly', () => {
  const fallback = evaluate({ nationality: 'French', dateOfBirth: null, country: 'France', aisMember: false,
    aisMembershipExpiry: null }, { malaysianCitizen: true, dateOfBirth: '1990-01-01',
    residingInMalaysia: true, aisMember: true, aisExpiry: '2026-01-02' });
  assert.equal(fallback.score, 100);

  const profileDatesWin = evaluate(passingProfile({
    dateOfBirth: new Date('2010-01-01T00:00:00.000Z'),
    aisMembershipExpiry: new Date('2025-12-31T00:00:00.000Z'),
  }), { dateOfBirth: '1990-01-01', aisExpiry: '2026-01-02' });
  assert.equal(profileDatesWin.score, 60);
  assert.match(profileDatesWin.explanation, /Age:/);
  assert.match(profileDatesWin.explanation, /Expired or not provided/);
});

function applicationDatabase({ profile = passingProfile(), types, applications = [] } = {}) {
  const typeRows = types ?? [
    { id: 'type-ordinary', code: 'ORDINARY', name: 'Ordinary Member', active: true, applicantSelectable: true },
    { id: 'type-lifetime', code: 'LIFETIME', name: 'Lifetime Member', active: true, applicantSelectable: true },
    { id: 'type-associate', code: 'ASSOCIATE', name: 'Associate Member', active: true, applicantSelectable: true },
  ];
  const state = { profile, types: typeRows, applications: [...applications], creates: 0, locks: 0 };
  let queue = Promise.resolve();

  const decorate = row => ({
    ...row,
    requestedMembershipType: row.requestedMembershipTypeId
      ? { name: state.types.find(type => type.id === row.requestedMembershipTypeId)?.name ?? null } : null,
    recommendedMembershipType: row.recommendedMembershipTypeId
      ? { name: state.types.find(type => type.id === row.recommendedMembershipTypeId)?.name ?? null } : null,
  });
  const latestFor = userId => state.applications.filter(row => row.userId === userId)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;

  const client = {
    memberProfile: { async findUnique({ where }) { return where.userId === ownId ? state.profile : null; } },
    membershipType: {
      async findUnique({ where }) { return state.types.find(type => type.code === where.code) ?? null; },
    },
    membershipApplication: {
      async findFirst({ where }) {
        if (where.id) {
          const row = state.applications.find(value => value.id === where.id && value.userId === where.userId);
          return row ? decorate(row) : null;
        }
        if (where.status) {
          const row = state.applications.filter(value => value.userId === where.userId && value.status === where.status)
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
          return row ? decorate(row) : null;
        }
        const row = latestFor(where.userId);
        return row ? decorate(row) : null;
      },
      async findMany({ where }) {
        return state.applications.filter(row => row.userId === where.userId)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()).map(decorate);
      },
      async create({ data }) {
        state.creates++;
        const timestamp = new Date(`2026-01-0${state.creates}T00:00:00.000Z`);
        const row = { id: applicationId, applicationNumber: null, submittedAt: null,
          createdAt: timestamp, updatedAt: timestamp, ...data };
        state.applications.push(row);
        return decorate(row);
      },
    },
    async $queryRaw() { state.locks++; return []; },
    async $transaction(work) {
      const run = queue.then(() => work(client));
      queue = run.catch(() => undefined);
      return run;
    },
  };
  const eligibility = new EligibilityService({ client });
  return { state, service: new MembershipApplicationsService({ client }, eligibility) };
}

function existingApplication(overrides = {}) {
  return { id: applicationId, userId: ownId, applicationNumber: null,
    requestedMembershipTypeId: 'type-associate', requestedMembershipTypeCode: 'ASSOCIATE',
    recommendedMembershipTypeId: 'type-associate', recommendedMembershipTypeCode: 'ASSOCIATE',
    eligibilityScore: 0, eligibilityExplanation: 'Original explanation', status: 'DRAFT', currentStep: 2,
    submittedAt: null, createdAt: new Date('2025-12-01T00:00:00.000Z'),
    updatedAt: new Date('2025-12-01T00:00:00.000Z'), reviewedByUserId: 'private-reviewer',
    legacyBase44Id: 'private-legacy-id', ...overrides };
}

test('eligibility/application endpoints require auth guards and controllers derive principal ownership', async () => {
  for (const controller of [EligibilityController, MembershipApplicationsController]) {
    assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, controller), [SupabaseJwtGuard, ActiveAccountGuard]);
  }
  let eligibilityOwner;
  const eligibilityController = new EligibilityController({ evaluateOwn: async id => { eligibilityOwner = id; return {}; } });
  await eligibilityController.evaluate({ id: ownId }, {});
  assert.equal(eligibilityOwner, ownId);

  let applicationOwner;
  const applicationsController = new MembershipApplicationsController({
    createDraft: async id => { applicationOwner = id; return {}; },
  });
  await applicationsController.createDraft({ id: ownId }, { requestedMembershipTypeCode: 'ASSOCIATE' });
  assert.equal(applicationOwner, ownId);

  const context = request => ({ switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function handler() {}, getClass: () => MembershipApplicationsController });
  const jwt = new SupabaseJwtGuard({ verifyAccessToken: async () => null }, { resolve: async () => ({}) });
  await assert.rejects(jwt.canActivate(context({ headers: {} })), error => error.getStatus() === 401);
  assert.throws(() => new ActiveAccountGuard().canActivate(context({ principal: { accountStatus: 'SUSPENDED' } })),
    error => error.getStatus() === 403);
});

test('draft creation server-generates canonical ASSOCIATE, ORDINARY, and LIFETIME fields', async () => {
  const associateDb = applicationDatabase({ profile: null });
  const associate = await associateDb.service.createDraft(ownId, { requestedMembershipTypeCode: 'ASSOCIATE' });
  assert.equal(associate.status, 'DRAFT');
  assert.equal(associate.currentStep, 2);
  assert.equal(associate.requestedMembershipType.code, 'ASSOCIATE');
  assert.equal(associate.recommendedMembershipType.code, 'ASSOCIATE');
  assert.equal(associate.eligibilityScore, 0);
  assert.equal(associateDb.state.applications[0].userId, ownId);

  for (const requestedMembershipTypeCode of ['ORDINARY', 'LIFETIME']) {
    const database = applicationDatabase();
    const result = await database.service.createDraft(ownId, { requestedMembershipTypeCode });
    assert.equal(result.requestedMembershipType.code, requestedMembershipTypeCode);
    assert.equal(result.recommendedMembershipType.code, 'ORDINARY');
    assert.equal(result.eligibilityScore, 100);
  }
});

test('draft rejects nonexistent, inactive, hidden, evaluator-disallowed, and client-owned canonical fields', async () => {
  await assert.rejects(applicationDatabase({ types: [] }).service.createDraft(ownId,
    { requestedMembershipTypeCode: 'ORDINARY' }), error => error.getStatus() === 400);
  await assert.rejects(applicationDatabase({ types: [
    { id: 'type-associate', code: 'ASSOCIATE', active: false, applicantSelectable: true },
  ], profile: null }).service.createDraft(ownId, { requestedMembershipTypeCode: 'ASSOCIATE' }),
  error => error.getStatus() === 400);
  await assert.rejects(applicationDatabase({ types: [
    { id: 'type-associate', code: 'ASSOCIATE', active: true, applicantSelectable: false },
  ], profile: null }).service.createDraft(ownId, { requestedMembershipTypeCode: 'ASSOCIATE' }),
  error => error.getStatus() === 400);
  await assert.rejects(applicationDatabase().service.createDraft(ownId,
    { requestedMembershipTypeCode: 'ASSOCIATE' }), error => error.getStatus() === 400);
  for (const forbidden of [
    { userId: otherId }, { status: 'SUBMITTED' }, { eligibilityScore: 100 },
    { recommendedMembershipTypeCode: 'ORDINARY' }, { eligibilityExplanation: 'trusted' },
  ]) {
    await assert.rejects(applicationDatabase({ profile: null }).service.createDraft(ownId,
      { requestedMembershipTypeCode: 'ASSOCIATE', ...forbidden }), error => error.getStatus() === 400);
  }
});

test('existing draft is returned unchanged; non-DRAFT current application cannot be edited', async () => {
  const draft = existingApplication();
  const database = applicationDatabase({ applications: [draft] });
  const result = await database.service.createDraft(ownId, { requestedMembershipTypeCode: 'ORDINARY' });
  assert.equal(result.requestedMembershipType.code, 'ASSOCIATE');
  assert.equal(result.eligibilityScore, 0);
  assert.equal(database.state.creates, 0);

  const submitted = applicationDatabase({ applications: [existingApplication({ status: 'SUBMITTED' })] });
  await assert.rejects(submitted.service.createDraft(ownId,
    { requestedMembershipTypeCode: 'ORDINARY' }), error => error.getStatus() === 409);
  assert.equal(submitted.state.creates, 0);
});

test('transaction lock prevents repeated/concurrent draft creation from duplicating rows', async () => {
  const database = applicationDatabase({ profile: null });
  const body = { requestedMembershipTypeCode: 'ASSOCIATE' };
  const [first, second] = await Promise.all([
    database.service.createDraft(ownId, body),
    database.service.createDraft(ownId, body),
  ]);
  assert.equal(first.id, second.id);
  assert.equal(database.state.creates, 1);
  assert.equal(database.state.locks, 2);
});

test('a historical draft is reused after a terminal latest record instead of creating a duplicate draft', async () => {
  const draft = existingApplication({ createdAt: new Date('2025-01-01T00:00:00.000Z') });
  const terminal = existingApplication({ id: '222e4567-e89b-42d3-a456-426614174002', status: 'REJECTED',
    createdAt: new Date('2025-12-01T00:00:00.000Z') });
  const database = applicationDatabase({ applications: [draft, terminal] });
  const result = await database.service.createDraft(ownId, { requestedMembershipTypeCode: 'ORDINARY' });
  assert.equal(result.id, draft.id);
  assert.equal(database.state.creates, 0);
});

test('own list/current/detail enforce ownership and return applicant-safe projections', async () => {
  const own = existingApplication();
  const other = existingApplication({ id: '222e4567-e89b-42d3-a456-426614174001', userId: otherId });
  const database = applicationDatabase({ applications: [own, other] });
  const list = await database.service.listOwn(ownId);
  assert.equal(list.length, 1);
  assert.equal((await database.service.currentOwn(ownId)).id, own.id);
  const detail = await database.service.detailOwn(ownId, own.id);
  assert.equal(detail.id, own.id);
  assert(!JSON.stringify(detail).includes('private-reviewer'));
  assert(!JSON.stringify(detail).includes('private-legacy-id'));
  assert(!JSON.stringify(detail).includes('MembershipTypeId'));
  await assert.rejects(database.service.detailOwn(ownId, other.id), error => error.getStatus() === 404);
  await assert.rejects(database.service.detailOwn(ownId, 'not-a-uuid'), error => error.getStatus() === 400);

  const terminal = applicationDatabase({ applications: [existingApplication({ status: 'REJECTED' })] });
  assert.equal(await terminal.service.currentOwn(ownId), null);
});
