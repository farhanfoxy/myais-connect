import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { ActiveAccountGuard } from '../dist/auth/active-account.guard.js';
import { SupabaseJwtGuard } from '../dist/auth/supabase-jwt.guard.js';
import { MembershipsController } from '../dist/memberships/memberships.controller.js';
import { MembershipsService } from '../dist/memberships/memberships.service.js';

const ownId = '111e4567-e89b-42d3-a456-426614174000';
const otherId = '111e4567-e89b-42d3-a456-426614174001';

function membership(overrides = {}) {
  return {
    id: '333e4567-e89b-42d3-a456-426614174000', userId: ownId, applicationId: 'application-private',
    membershipTypeId: 'type-private', membershipNumber: 'MYAIS-2026-000123', membershipTypeCode: 'ASSOCIATE',
    membershipTypeName: 'Associate Member', status: 'ACTIVE', startDate: new Date('2026-03-01T00:00:00Z'),
    expiryDate: new Date('2027-02-28T00:00:00Z'), votingEligible: false,
    membershipType: { code: 'ASSOCIATE', name: 'Associate Member' },
    activatedAt: new Date('2026-03-01T01:02:03Z'), createdAt: new Date('2026-03-01T01:02:03Z'),
    legacyBase44Id: 'legacy-private', ...overrides,
  };
}

function database(rows) {
  let query;
  const service = new MembershipsService({ client: { membership: { async findFirst(args) {
    query = args;
    const candidates = rows.filter(row => row.userId === args.where.userId && row.status === args.where.status)
      .sort((left, right) => right.createdAt.valueOf() - left.createdAt.valueOf() || right.id.localeCompare(left.id));
    const row = candidates[0];
    if (!row) return null;
    return Object.fromEntries(Object.keys(args.select).map(field => [field, row[field]]));
  } } } });
  return { service, get query() { return query; } };
}

test('current membership route requires JWT and ACTIVE account and derives ownership', async () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, MembershipsController),
    [SupabaseJwtGuard, ActiveAccountGuard]);
  const requestContext = request => ({ switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => MembershipsController.prototype.current, getClass: () => MembershipsController });
  const jwt = new SupabaseJwtGuard({ verifyAccessToken: async () => ({}) }, { resolve: async () => ({ id: ownId }) });
  await assert.rejects(jwt.canActivate(requestContext({ headers: {} })), error => error.getStatus() === 401);
  assert.throws(() => new ActiveAccountGuard().canActivate(requestContext({ principal: { accountStatus: 'SUSPENDED' } })),
    error => error.getStatus() === 403);
  let owner;
  const controller = new MembershipsController({ currentOwn: async id => { owner = id; return null; } });
  await controller.current({ id: ownId });
  assert.equal(owner, ownId);
});

test('no owned ACTIVE membership returns null and expired or other-user rows are ignored', async () => {
  const source = database([membership({ status: 'EXPIRED' }), membership({ id: 'other', userId: otherId })]);
  assert.equal(await source.service.currentOwn(ownId), null);
  assert.deepEqual(source.query.where, { userId: ownId, status: 'ACTIVE' });
});

test('one ACTIVE membership returns only the safe card projection', async () => {
  const result = await database([membership()]).service.currentOwn(ownId);
  assert.deepEqual(result, {
    membershipNumber: 'MYAIS-2026-000123', membershipTypeCode: 'ASSOCIATE', membershipTypeName: 'Associate Member',
    status: 'ACTIVE', startDate: '2026-03-01', expiryDate: '2027-02-28', votingEligible: false,
    activatedAt: '2026-03-01T01:02:03.000Z',
  });
  for (const hidden of ['userId', 'applicationId', 'membershipTypeId', 'legacyBase44Id', '333e4567']) {
    assert(!JSON.stringify(result).includes(hidden));
  }
});

test('multiple ACTIVE memberships select createdAt DESC then id DESC deterministically', async () => {
  const older = membership({ id: '00000000-0000-4000-8000-000000000001', membershipNumber: 'OLDER',
    createdAt: new Date('2026-01-01T00:00:00Z') });
  const tieLow = membership({ id: '00000000-0000-4000-8000-000000000002', membershipNumber: 'TIE-LOW',
    createdAt: new Date('2026-02-01T00:00:00Z') });
  const tieHigh = membership({ id: '00000000-0000-4000-8000-000000000003', membershipNumber: 'TIE-HIGH',
    createdAt: new Date('2026-02-01T00:00:00Z') });
  const source = database([older, tieLow, tieHigh]);
  assert.equal((await source.service.currentOwn(ownId)).membershipNumber, 'TIE-HIGH');
  assert.deepEqual(source.query.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
});
