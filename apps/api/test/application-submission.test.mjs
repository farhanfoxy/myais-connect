import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EligibilityService } from '../dist/eligibility/eligibility.service.js';
import {
  MembershipApplicationsService,
  myaisBusinessYear,
} from '../dist/membership-applications/membership-applications.service.js';

const ownId = '111e4567-e89b-42d3-a456-426614174000';
const otherId = '111e4567-e89b-42d3-a456-426614174001';
const applicationId = '222e4567-e89b-42d3-a456-426614174000';
const otherApplicationId = '222e4567-e89b-42d3-a456-426614174001';

function profile(overrides = {}) {
  return { userId: ownId, fullName: 'Applicant Name', identificationType: 'NRIC',
    identificationNumber: 'ID-1', nationality: 'Malaysian', dateOfBirth: new Date('1990-01-01T00:00:00Z'),
    gender: 'OTHER', phoneNumber: '+60123', addressLine1: 'Address', addressLine2: null, city: 'City',
    state: 'Selangor', postcode: '40000', country: 'Malaysia', institution: 'Institution',
    occupation: 'Occupation', department: 'Department', areaOfExpertise: 'Expertise', aisMember: true,
    aisMembershipNumber: 'AIS-1', aisMembershipExpiry: new Date('2035-01-01T00:00:00Z'), ...overrides };
}

function application(overrides = {}) {
  return { id: applicationId, userId: ownId, applicationNumber: null, status: 'DRAFT', currentStep: 2,
    requestedMembershipTypeId: 'type-ordinary', requestedMembershipTypeCode: 'ORDINARY',
    recommendedMembershipTypeId: 'type-ordinary', recommendedMembershipTypeCode: 'ORDINARY',
    eligibilityScore: 100, eligibilityExplanation: 'Eligible', latestReviewerRemarks: null,
    rejectionReason: null, submittedAt: null, createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'), user: { fullName: 'Applicant Name',
      legacyFullName: null, email: 'applicant@example.test' }, ...overrides };
}

function documents(appId = applicationId, userId = ownId) {
  return ['IDENTIFICATION', 'AIS_MEMBERSHIP_PROOF', 'PROFILE_PHOTO'].map((documentType, index) => ({
    id: `333e4567-e89b-42d3-a456-42661417400${index}`, applicationId: appId, userId, documentType,
    storageObjectKey: `applications/${appId}/object-${index}`, fileUrl: null, legacyBase44Id: null,
    originalFileName: `document-${index}.pdf`, mimeType: 'application/pdf', fileSize: 100,
    verificationStatus: 'PENDING', reviewerRemarks: null, verifiedAt: null,
    createdAt: new Date(`2026-01-0${index + 1}T00:00:00Z`),
  }));
}

function submissionDatabase(options = {}) {
  const currentYear = myaisBusinessYear(new Date());
  const state = {
    applications: options.applications ?? [application()],
    profiles: options.profiles ?? [profile()],
    types: options.types ?? [{ id: 'type-ordinary', code: 'ORDINARY', name: 'Ordinary Member',
      active: true, applicantSelectable: true }],
    documents: options.documents ?? documents(),
    reviews: options.reviews ?? [],
    requests: options.requests ?? [],
    audits: [], notifications: [], locks: 0,
  };
  if (options.existingSuffix) state.applications.push(application({
    id: '222e4567-e89b-42d3-a456-426614174099', userId: otherId, status: 'SUBMITTED',
    applicationNumber: `MYAIS-APP-${currentYear}-${String(options.existingSuffix).padStart(6, '0')}`,
  }));
  let queue = Promise.resolve();
  const decorate = row => ({ ...row,
    requestedMembershipType: row.requestedMembershipTypeId
      ? { name: state.types.find(type => type.id === row.requestedMembershipTypeId)?.name ?? null } : null,
    recommendedMembershipType: row.recommendedMembershipTypeId
      ? { name: state.types.find(type => type.id === row.recommendedMembershipTypeId)?.name ?? null } : null,
    applicationDocumentRecordsByApplication: state.documents.filter(doc => doc.applicationId === row.id),
    applicationReviewRecordsByApplication: state.reviews.filter(review => review.applicationId === row.id),
    informationRequestRecordsByApplication: state.requests.filter(request =>
      request.applicationId === row.id && request.status === 'OPEN'),
  });
  const client = {
    memberProfile: {
      async findUnique({ where }) { return state.profiles.find(value => value.userId === where.userId) ?? null; },
    },
    membershipType: {
      async findUnique({ where }) {
        return state.types.find(type => where.id ? type.id === where.id : type.code === where.code) ?? null;
      },
    },
    membershipApplication: {
      async findFirst({ where, select }) {
        const row = state.applications.find(value => value.id === where.id && value.userId === where.userId);
        if (!row) return null;
        return select?.user ? { id: row.id, status: row.status,
          requestedMembershipTypeId: row.requestedMembershipTypeId, user: row.user } : decorate(row);
      },
      async findMany({ where }) {
        if (where.applicationNumber) return state.applications
          .filter(row => row.applicationNumber?.startsWith(where.applicationNumber.startsWith))
          .map(row => ({ applicationNumber: row.applicationNumber }));
        return state.applications.filter(row => row.userId === where.userId).map(decorate);
      },
      async update({ where, data }) {
        const row = state.applications.find(value => value.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return decorate(row);
      },
    },
    applicationDocument: {
      async findMany({ where }) {
        return state.documents.filter(doc => doc.applicationId === where.applicationId && doc.userId === where.userId);
      },
    },
    auditLog: { async create({ data }) { state.audits.push(data); return data; } },
    notification: { async create({ data }) {
      if (options.failNotification) throw new Error('notification insert failed');
      state.notifications.push(data); return data;
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
  const eligibility = new EligibilityService({ client });
  return { state, service: new MembershipApplicationsService({ client }, eligibility) };
}

test('complete DRAFT submits atomically with legacy audit/notification wording and next sequence', async () => {
  const database = submissionDatabase({ existingSuffix: 7 });
  const result = await database.service.submitOwn(ownId, applicationId, { declarationAccepted: true });
  const year = myaisBusinessYear(new Date());
  assert.equal(result.status, 'SUBMITTED');
  assert.equal(result.currentStep, 4);
  assert.equal(result.applicationNumber, `MYAIS-APP-${year}-000008`);
  assert.match(result.submittedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(database.state.audits, [{ actorUserId: ownId, actorName: 'Applicant Name',
    action: 'APPLICATION_SUBMITTED', entityType: 'MembershipApplication',
    description: `Application MYAIS-APP-${year}-000008 submitted by Applicant Name` }]);
  assert.deepEqual(database.state.notifications, [{ userId: ownId, title: 'Application Submitted',
    message: `Your application MYAIS-APP-${year}-000008 has been submitted and will be reviewed by the committee.`,
    type: 'APPLICATION', eventType: 'APPLICATION_SUBMITTED', relatedEntityType: 'MembershipApplication', actionUrl: '/my-application/tracker' }]);
});

test('submission accepts only declaration true and never trusts canonical application fields', async () => {
  for (const input of [{}, { declarationAccepted: false }, { declarationAccepted: true, status: 'SUBMITTED' },
    { declarationAccepted: true, applicationNumber: 'CLIENT' }, { declarationAccepted: true, eligibilityScore: 100 },
    { declarationAccepted: true, userId: otherId }]) {
    await assert.rejects(submissionDatabase().service.submitOwn(ownId, applicationId, input),
      error => error.getStatus() === 400);
  }
});

test('submission rejects incomplete profile and every missing required document type', async () => {
  await assert.rejects(submissionDatabase({ profiles: [profile({ city: '' })] }).service
    .submitOwn(ownId, applicationId, { declarationAccepted: true }), error => error.getStatus() === 400);
  for (const missing of ['IDENTIFICATION', 'AIS_MEMBERSHIP_PROOF', 'PROFILE_PHOTO']) {
    const database = submissionDatabase({ documents: documents().filter(row => row.documentType !== missing) });
    await assert.rejects(database.service.submitOwn(ownId, applicationId, { declarationAccepted: true }), error =>
      error.getStatus() === 400 && JSON.stringify(error.getResponse()).includes(missing));
  }
});

test('submission rechecks active/selectable membership type and current eligibility', async () => {
  for (const type of [
    { id: 'type-ordinary', code: 'ORDINARY', name: 'Ordinary', active: false, applicantSelectable: true },
    { id: 'type-ordinary', code: 'ORDINARY', name: 'Ordinary', active: true, applicantSelectable: false },
  ]) {
    await assert.rejects(submissionDatabase({ types: [type] }).service
      .submitOwn(ownId, applicationId, { declarationAccepted: true }), error => error.getStatus() === 400);
  }
  const changed = submissionDatabase({ profiles: [profile({ nationality: 'French', country: 'France',
    aisMember: false, aisMembershipNumber: null, aisMembershipExpiry: null })] });
  await assert.rejects(changed.service.submitOwn(ownId, applicationId, { declarationAccepted: true }),
    error => error.getStatus() === 400);
});

test('foreign and repeated submissions are hidden/rejected and one application submits only once concurrently', async () => {
  await assert.rejects(submissionDatabase().service.submitOwn(otherId, applicationId,
    { declarationAccepted: true }), error => error.getStatus() === 404);
  const database = submissionDatabase();
  const results = await Promise.allSettled([
    database.service.submitOwn(ownId, applicationId, { declarationAccepted: true }),
    database.service.submitOwn(ownId, applicationId, { declarationAccepted: true }),
  ]);
  assert.deepEqual(results.map(result => result.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(results.find(result => result.status === 'rejected').reason.getStatus(), 409);
  assert.equal(database.state.audits.length, 1);
  assert.equal(database.state.notifications.length, 1);
});

test('concurrent submissions allocate distinct current-year numbers', async () => {
  const secondProfile = profile({ userId: otherId, fullName: 'Other Applicant' });
  const secondApplication = application({ id: otherApplicationId, userId: otherId,
    user: { fullName: 'Other Applicant', legacyFullName: null, email: 'other@example.test' } });
  const database = submissionDatabase({ applications: [application(), secondApplication],
    profiles: [profile(), secondProfile], documents: [...documents(), ...documents(otherApplicationId, otherId)] });
  const results = await Promise.all([
    database.service.submitOwn(ownId, applicationId, { declarationAccepted: true }),
    database.service.submitOwn(otherId, otherApplicationId, { declarationAccepted: true }),
  ]);
  assert.equal(new Set(results.map(result => result.applicationNumber)).size, 2);
  for (const result of results) assert.match(result.applicationNumber, /^MYAIS-APP-\d{4}-\d{6}$/);
});

test('application-number year uses Asia/Kuala_Lumpur across the UTC New Year boundary', () => {
  assert.equal(myaisBusinessYear(new Date('2025-12-31T15:59:59.999Z')), 2025);
  assert.equal(myaisBusinessYear(new Date('2025-12-31T16:00:00.000Z')), 2026);
});

test('transaction failure rolls application, number, audit, and notification back to DRAFT', async () => {
  const database = submissionDatabase({ failNotification: true });
  await assert.rejects(database.service.submitOwn(ownId, applicationId, { declarationAccepted: true }),
    /notification insert failed/);
  assert.equal(database.state.applications[0].status, 'DRAFT');
  assert.equal(database.state.applications[0].applicationNumber, null);
  assert.equal(database.state.audits.length, 0);
  assert.equal(database.state.notifications.length, 0);
});

test('tracking projection includes applicant-visible history/documents/open requests and omits internals', async () => {
  const database = submissionDatabase({
    reviews: [{ id: 'review-1', applicationId, decision: 'ADDITIONAL_INFORMATION_REQUIRED', remarks: 'Clarify ID',
      reviewerName: 'Committee Member', reviewerUserId: 'private-reviewer',
      createdAt: new Date('2026-01-03T00:00:00Z'), legacyBase44Id: 'private-review' }],
    requests: [{ id: 'request-1', applicationId, requestedByName: 'Committee Member', message: 'Please clarify',
      dueDate: new Date('2026-02-01T00:00:00Z'), status: 'OPEN',
      createdAt: new Date('2026-01-04T00:00:00Z'), requestedByUserId: 'private-requester' }],
  });
  database.state.applications[0].latestReviewerRemarks = 'Applicant-visible remark';
  database.state.applications[0].rejectionReason = 'Applicant-visible reason';
  const result = await database.service.detailOwn(ownId, applicationId);
  assert.equal(result.documents.length, 3);
  assert.equal(result.reviewHistory[0].reviewerName, 'Committee Member');
  assert.equal(result.openInformationRequests[0].message, 'Please clarify');
  assert.equal(result.latestReviewerRemarks, 'Applicant-visible remark');
  assert.equal(result.rejectionReason, 'Applicant-visible reason');
  const serialized = JSON.stringify(result);
  for (const secret of ['storageObjectKey', 'fileUrl', 'reviewerUserId', 'requestedByUserId',
    'legacyBase44Id', 'private-reviewer', 'private-requester']) assert(!serialized.includes(secret));
});
