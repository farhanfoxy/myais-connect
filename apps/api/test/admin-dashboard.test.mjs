import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { ActiveAccountGuard } from '../dist/auth/active-account.guard.js';
import { RolesGuard } from '../dist/auth/roles.guard.js';
import { SupabaseJwtGuard } from '../dist/auth/supabase-jwt.guard.js';
import { AdminDashboardController, dashboardRoles } from '../dist/admin-dashboard/admin-dashboard.controller.js';
import { AdminDashboardService } from '../dist/admin-dashboard/admin-dashboard.service.js';

const now = new Date('2026-10-11T04:00:00.000Z');
const user = (id, name) => ({ id, email: `${id}@example.test`, fullName: name, legacyFullName: null });
const memberships = [
  { id: 'm1-old', userId: 'u1', status: 'ACTIVE', activatedAt: new Date('2026-09-15T04:00:00Z'),
    createdAt: new Date('2026-09-15T04:00:00Z'), expiryDate: new Date('2027-09-15T00:00:00Z'),
    membershipTypeCode: 'ORDINARY', membershipTypeName: 'Ordinary Member', membershipType: { code: 'ORDINARY', name: 'Ordinary Member' } },
  { id: 'm1-new', userId: 'u1', status: 'ACTIVE', activatedAt: new Date('2026-09-20T04:00:00Z'),
    createdAt: new Date('2026-09-20T04:00:00Z'), expiryDate: null,
    membershipTypeCode: 'LIFETIME', membershipTypeName: 'Lifetime Member', membershipType: { code: 'LIFETIME', name: 'Lifetime Member' } },
  { id: 'm2', userId: 'u2', status: 'ACTIVE', activatedAt: new Date('2026-10-01T04:00:00Z'),
    createdAt: new Date('2026-10-01T04:00:00Z'), expiryDate: new Date('2026-10-20T00:00:00Z'),
    membershipTypeCode: 'ASSOCIATE', membershipTypeName: 'Associate Member', membershipType: { code: 'ASSOCIATE', name: 'Associate Member' } },
  { id: 'm3', userId: 'u3', status: 'ACTIVE', activatedAt: new Date('2026-10-03T04:00:00Z'),
    createdAt: new Date('2026-10-03T04:00:00Z'), expiryDate: null,
    membershipTypeCode: 'HONORARY', membershipTypeName: 'Honorary Member', membershipType: { code: 'HONORARY', name: 'Honorary Member' } },
  { id: 'm4', userId: 'u4', status: 'SUSPENDED', activatedAt: new Date('2026-08-01T04:00:00Z'),
    createdAt: new Date('2026-08-01T04:00:00Z'), expiryDate: new Date('2026-10-15T00:00:00Z'),
    membershipTypeCode: 'ORDINARY', membershipTypeName: 'Ordinary Member', membershipType: { code: 'ORDINARY', name: 'Ordinary Member' } },
];
const applications = [
  { id: 'a1', applicationNumber: 'MYAIS-APP-2026-000001', status: 'SUBMITTED',
    submittedAt: new Date('2026-10-01T04:00:00Z'), reviewedAt: null, updatedAt: new Date('2026-10-01T04:00:00Z'),
    user: user('applicant-1', 'Applicant One') },
  { id: 'a2', applicationNumber: 'MYAIS-APP-2026-000002', status: 'UNDER_REVIEW',
    submittedAt: new Date('2026-09-28T04:00:00Z'), reviewedAt: new Date('2026-10-02T04:00:00Z'),
    updatedAt: new Date('2026-10-02T04:00:00Z'), user: user('applicant-2', 'Applicant Two') },
  { id: 'a3', applicationNumber: 'MYAIS-APP-2026-000003', status: 'ADDITIONAL_INFORMATION_REQUIRED',
    submittedAt: new Date('2026-09-20T04:00:00Z'), reviewedAt: new Date('2026-09-22T04:00:00Z'),
    updatedAt: new Date('2026-09-23T04:00:00Z'), user: user('applicant-3', 'Applicant Three') },
  { id: 'a4', applicationNumber: 'MYAIS-APP-2026-000004', status: 'RECOMMENDED_FOR_APPROVAL',
    submittedAt: new Date('2026-09-15T04:00:00Z'), reviewedAt: new Date('2026-09-16T04:00:00Z'),
    updatedAt: new Date('2026-09-18T04:00:00Z'), user: user('applicant-4', 'Applicant Four') },
];
const payments = [
  { id: 'p1', paymentReference: 'MYAIS-PAY-2026-000001', status: 'SUBMITTED', totalAmount: { toString: () => '150' },
    currency: 'MYR', submittedAt: new Date('2026-10-01T04:00:00Z'), createdAt: new Date('2026-09-30T04:00:00Z'),
    application: { applicationNumber: 'MYAIS-APP-2026-000001' }, user: user('applicant-1', 'Applicant One') },
  { id: 'p2', paymentReference: 'MYAIS-PAY-2026-000002', status: 'UNDER_VERIFICATION', totalAmount: { toString: () => '100' },
    currency: 'MYR', submittedAt: new Date('2026-10-02T04:00:00Z'), createdAt: new Date('2026-10-02T04:00:00Z'),
    application: { applicationNumber: 'MYAIS-APP-2026-000002' }, user: user('applicant-2', 'Applicant Two') },
  { id: 'p3', paymentReference: 'MYAIS-PAY-2026-000003', status: 'VERIFIED', totalAmount: { toString: () => '0' },
    currency: 'MYR', submittedAt: new Date('2026-09-01T04:00:00Z'), createdAt: new Date('2026-09-01T04:00:00Z'),
    application: null, user: user('applicant-3', 'Applicant Three') },
];
const events = [
  { id: 'e1', eventNumber: 'MYAIS-EVT-2026-0001', title: 'Future Forum', status: 'PUBLISHED',
    startDate: new Date('2026-10-20T00:00:00Z'), startTime: '09:00', venueType: 'ONLINE', venueName: null,
    _count: { eventRegistrationRecordsByEvent: 12 } },
  { id: 'e2', eventNumber: 'MYAIS-EVT-2026-0002', title: 'Draft Forum', status: 'DRAFT',
    startDate: new Date('2026-10-21T00:00:00Z'), startTime: '09:00', venueType: 'ONLINE', venueName: null,
    _count: { eventRegistrationRecordsByEvent: 0 } },
  { id: 'e3', eventNumber: 'MYAIS-EVT-2026-0003', title: 'Past Forum', status: 'PUBLISHED',
    startDate: new Date('2026-10-01T00:00:00Z'), startTime: '09:00', venueType: 'PHYSICAL', venueName: 'KL',
    _count: { eventRegistrationRecordsByEvent: 8 } },
];

function database() {
  const queries = { applications: 0, payments: 0, applicationWhere: [], paymentWhere: [] };
  const client = {
    membership: { async findMany(args) {
      let rows = memberships.filter(row => !args.where.status || row.status === args.where.status);
      if (args.where.activatedAt) rows = rows.filter(row => row.activatedAt >= args.where.activatedAt.gte && row.activatedAt <= args.where.activatedAt.lte);
      if (args.distinct) {
        rows = [...rows].sort((a, b) => a.userId.localeCompare(b.userId) || b.createdAt - a.createdAt);
        rows = rows.filter((row, index) => rows.findIndex(value => value.userId === row.userId) === index);
      }
      return rows;
    } },
    event: {
      async findMany({ where, take }) { return events.filter(row => row.status === where.status && row.startDate >= where.startDate.gte).slice(0, take); },
      async count({ where }) { return events.filter(row => row.status === where.status && row.startDate >= where.startDate.gte).length; },
    },
    membershipApplication: {
      async groupBy({ where }) { queries.applications += 1; queries.applicationWhere.push(where);
        return [...new Set(applications.map(row => row.status))]
        .filter(status => where.status.in.includes(status)).map(status => ({ status,
          _count: { _all: applications.filter(row => row.status === status).length } })); },
      async findMany({ where, take }) { queries.applications += 1; queries.applicationWhere.push(where);
        if (where.submittedAt) return applications.filter(row => row.submittedAt >= where.submittedAt.gte && row.submittedAt <= where.submittedAt.lte);
        const statuses = typeof where.status === 'string' ? [where.status] : where.status.in;
        return applications.filter(row => statuses.includes(row.status))
          .sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime()).slice(0, take); },
    },
    payment: {
      async groupBy({ where }) { queries.payments += 1; queries.paymentWhere.push(where);
        return [...new Set(payments.map(row => row.status))]
        .filter(status => where.status.in.includes(status)).map(status => ({ status,
          _count: { _all: payments.filter(row => row.status === status).length } })); },
      async findMany({ where, take }) { queries.payments += 1; queries.paymentWhere.push(where);
        return payments.filter(row => where.status.in.includes(row.status)).slice(0, take); },
    },
    auditLog: { async findMany({ where, take }) { return [{ action: where.action.in[0], entityType: 'MembershipApplication',
      actorName: 'Committee Person', description: 'Action on MYAIS-APP-2026-000001. Remarks: private remark',
      createdAt: new Date('2026-10-10T04:00:00Z') }].slice(0, take); } },
  };
  return { queries, service: new AdminDashboardService({ client }) };
}

function principal(role = 'SYSTEM_ADMINISTRATOR', accountStatus = 'ACTIVE') {
  return { id: 'viewer', email: 'viewer@example.test', fullName: 'Dashboard Viewer', role, accountStatus,
    supabaseAuthUserId: 'auth-viewer', photoUrl: null, profilePhotoObjectKey: null };
}

function context(request) {
  return { switchToHttp: () => ({ getRequest: () => request }), getHandler: () => AdminDashboardController.prototype.get,
    getClass: () => AdminDashboardController };
}

test('dashboard route requires authentication, ACTIVE status and only canonical committee roles', async () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, AdminDashboardController),
    [SupabaseJwtGuard, ActiveAccountGuard, RolesGuard]);
  assert.deepEqual([...dashboardRoles], ['PRESIDENT', 'DEPUTY_PRESIDENT', 'SECRETARY', 'ASSISTANT_SECRETARY',
    'TREASURER', 'COMMITTEE_MEMBER', 'SYSTEM_ADMINISTRATOR']);
  const roles = new RolesGuard(new Reflector());
  for (const role of dashboardRoles) assert.equal(roles.canActivate(context({ principal: principal(role) })), true);
  assert.throws(() => roles.canActivate(context({ principal: principal('APPLICANT') })), error => error.getStatus() === 403);
  assert.throws(() => roles.canActivate(context({})), error => error.getStatus() === 401);
  assert.throws(() => new ActiveAccountGuard().canActivate(context({ principal: principal('TREASURER', 'SUSPENDED') })),
    error => error.getStatus() === 403);
});

test('system dashboard calculates canonical metrics, truthful trends and safe projections', async () => {
  const db = database(); const result = await db.service.get(principal(), now);
  assert.equal(result.kpis.activeMembers, 3);
  assert.equal(result.kpis.applicationsNeedingReview, 2);
  assert.equal(result.kpis.finalApprovals, 1);
  assert.equal(result.kpis.paymentsToVerify, 2);
  assert.equal(result.kpis.upcomingEvents, 1);
  assert.deepEqual(result.charts.membershipDistribution.map(item => [item.code, item.value]),
    [['ASSOCIATE', 1], ['HONORARY', 1], ['LIFETIME', 1]]);
  assert.equal(result.charts.membershipActivity.find(item => item.key === '2026-09').value, 1);
  assert.equal(result.charts.membershipActivity.find(item => item.key === '2026-10').value, 2);
  assert.equal(result.charts.applicationPipeline.find(item => item.status === 'ADDITIONAL_INFORMATION_REQUIRED').value, 1);
  assert.equal(result.charts.applicationActivity.find(item => item.key === '2026-10').value, 1);
  assert.equal(result.operationalInsights.membershipsExpiringSoon, 1);
  assert.equal(result.upcomingEvents[0].title, 'Future Forum');
  assert.equal(result.upcomingEvents[0].registrationCount, 12);
  assert.equal(result.attention[0].status, 'RECOMMENDED_FOR_APPROVAL');
  assert.equal(result.attention.some(item => item.kind === 'APPLICATION'), true);
  assert.equal(result.attention.some(item => item.kind === 'PAYMENT'), true);
  assert.match(result.attention[0].waitingLabel, /^Waiting \d+ days$/);
  assert.equal(result.recentActivity[0].reference, 'MYAIS-APP-2026-000001');
  assert.equal('description' in result.recentActivity[0], false);
  assert.equal(JSON.stringify(result).includes('private remark'), false);
  assert.equal(JSON.stringify(result).match(/identification|storageObjectKey|email/), null);
  assert.equal(db.queries.applicationWhere.some(where => where.userId?.not === 'viewer'), true);
  assert.equal(db.queries.paymentWhere.every(where => where.userId?.not === 'viewer'), true);
});

test('active-member aggregates use only the newest ACTIVE membership per user', async () => {
  const result = await database().service.get(principal('PRESIDENT'), now);
  assert.equal(result.kpis.activeMembers, 3);
  assert.equal(result.charts.membershipDistribution.some(item => item.code === 'ORDINARY'), false);
  assert.equal(result.charts.membershipDistribution.find(item => item.code === 'LIFETIME').value, 1);
});

test('Treasurer receives payment workload with no reviewer analytics or application query', async () => {
  const db = database(); const result = await db.service.get(principal('TREASURER'), now);
  assert.equal(result.kpis.paymentsToVerify, 2);
  assert.equal(result.permissions.reviewApplications, false);
  assert.equal('applicationsNeedingReview' in result.kpis, false);
  assert.equal('applicationPipeline' in result.charts, false);
  assert.equal(result.attention.every(item => item.kind === 'PAYMENT'), true);
  assert.equal(db.queries.applications, 0);
});

test('Committee Member receives reviewer workload and no payment payload or payment query', async () => {
  const db = database(); const result = await db.service.get(principal('COMMITTEE_MEMBER'), now);
  assert.equal(result.kpis.applicationsNeedingReview, 2);
  assert.equal(result.permissions.verifyPayments, false);
  assert.equal('paymentsToVerify' in result.kpis, false);
  assert.equal('paymentStatus' in result.charts, false);
  assert.equal(result.attention.every(item => item.kind === 'APPLICATION'), true);
  assert.equal(db.queries.payments, 0);
});

test('upcoming-event query uses published status and Malaysia business date semantics', async () => {
  const result = await database().service.get(principal('PRESIDENT'), new Date('2026-10-10T16:30:00.000Z'));
  assert.equal(result.upcomingEvents.length, 1);
  assert.equal(result.upcomingEvents[0].eventNumber, 'MYAIS-EVT-2026-0001');
});
