import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { UserRole } from '@myais/database';
import { ReportsController } from '../dist/reports/reports.controller.js';
import { ReportsService } from '../dist/reports/reports.service.js';

const actor = { id: '111e4567-e89b-42d3-a456-426614174000', role: UserRole.SYSTEM_ADMINISTRATOR,
  accountStatus: 'ACTIVE', fullName: 'Report Administrator', email: 'admin@example.test' };

function emptyClient(calls = {}) {
  return { user: { async findMany(input) { calls.user = input; return []; } },
    membership: { async findMany(input) { calls.membership = input; return []; } },
    membershipApplication: { async findMany(input) { calls.application = input; return []; } },
    payment: { async findMany(input) { calls.payment = input; return []; } },
    event: { async findMany(input) { calls.event = input; return []; } },
    auditLog: { async create(input) { (calls.audits ??= []).push(input); return {}; } } };
}

test('reported ACTIVE membership CSV request uses the true relation and inclusive calendar dates', async () => {
  const calls = {}; const service = new ReportsService({ client: emptyClient(calls) });
  const result = await service.export(actor, 'membership',
    { format: 'csv', status: 'ACTIVE', from: '2026-09-16', to: '2026-10-12' });
  assert.equal(calls.membership.where.status, 'ACTIVE');
  assert.equal(calls.membership.where.membershipType, undefined);
  assert.equal(calls.membership.where.startDate.gte.toISOString(), '2026-09-16T00:00:00.000Z');
  assert.equal(calls.membership.where.startDate.lt.toISOString(), '2026-10-13T00:00:00.000Z');
  assert.match(result.data.toString('utf8'), /^\uFEFF"Membership number"/);
  assert.equal(result.contentType, 'text/csv; charset=utf-8');
});

test('timestamp report filters use Malaysia calendar-day boundaries independent of host timezone', async () => {
  const calls = {}; const service = new ReportsService({ client: emptyClient(calls) });
  await service.export(actor, 'application',
    { format: 'csv', from: '2026-09-16', to: '2026-10-12' });
  assert.equal(calls.application.where.submittedAt.gte.toISOString(), '2026-09-15T16:00:00.000Z');
  assert.equal(calls.application.where.submittedAt.lt.toISOString(), '2026-10-12T16:00:00.000Z');
});

test('every report type produces valid empty CSV and XLSX files with authorized roles', async () => {
  const cases = [
    ['member-directory', UserRole.SECRETARY], ['membership', UserRole.SECRETARY],
    ['application', UserRole.ASSISTANT_SECRETARY], ['payment', UserRole.TREASURER],
    ['event', UserRole.PRESIDENT],
  ];
  for (const [type, role] of cases) {
    for (const format of ['csv', 'xlsx']) {
      const result = await new ReportsService({ client: emptyClient() }).export({ ...actor, role }, type, { format });
      assert(result.data.byteLength > 0, `${type} ${format} must not be empty`);
      if (format === 'csv') assert.equal(result.data.subarray(0, 3).toString('hex'), 'efbbbf');
      else assert.equal(result.data.subarray(0, 2).toString(), 'PK');
    }
  }
});

test('controller preserves attachment metadata for browser downloads', async () => {
  const controller = new ReportsController({ async export() { return { data: Buffer.from('report'),
    filename: 'myais-membership-2026-10-12.csv', contentType: 'text/csv; charset=utf-8' }; } });
  const stream = await controller.export(actor, 'membership', { format: 'csv' });
  assert.deepEqual(stream.getHeaders(), { type: 'text/csv; charset=utf-8',
    disposition: 'attachment; filename="myais-membership-2026-10-12.csv"', length: 6 });
});

test('invalid ranges and unauthorized report categories remain rejected', async () => {
  const service = new ReportsService({ client: emptyClient() });
  await assert.rejects(service.export(actor, 'membership',
    { format: 'csv', from: '2026-10-12', to: '2026-09-16' }), error => error.getStatus() === 400);
  await assert.rejects(service.export({ ...actor, role: UserRole.COMMITTEE_MEMBER }, 'membership',
    { format: 'csv' }), error => error.getStatus() === 403);
});
