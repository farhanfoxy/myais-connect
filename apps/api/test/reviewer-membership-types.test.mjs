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
import { MembershipTypesService } from '../dist/membership-types/membership-types.service.js';
import {
  ReviewerMembershipTypesController,
} from '../dist/membership-types/reviewer-membership-types.controller.js';

const approverRoles = [UserRole.PRESIDENT, UserRole.SYSTEM_ADMINISTRATOR];
const deniedRoles = [
  UserRole.DEPUTY_PRESIDENT,
  UserRole.SECRETARY,
  UserRole.ASSISTANT_SECRETARY,
  UserRole.TREASURER,
  UserRole.COMMITTEE_MEMBER,
  UserRole.ADMIN,
  UserRole.APPLICANT,
  UserRole.ORDINARY_MEMBER,
  UserRole.LIFETIME_MEMBER,
  UserRole.ASSOCIATE_MEMBER,
  UserRole.HONORARY_MEMBER,
];

function principal(overrides = {}) {
  return {
    id: '111e4567-e89b-42d3-a456-426614174000',
    email: 'approver@example.test',
    role: UserRole.PRESIDENT,
    accountStatus: 'ACTIVE',
    ...overrides,
  };
}

function context(request) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ReviewerMembershipTypesController.prototype.list,
    getClass: () => ReviewerMembershipTypesController,
  };
}

function membershipTypeService() {
  const source = [
    { id: 'ordinary', code: 'ORDINARY', name: 'Ordinary Member', description: 'Applicant type',
      entranceFee: 100, membershipFee: 50, active: true, applicantSelectable: true },
    { id: 'honorary', code: 'HONORARY', name: 'Honorary Member', description: 'Approver only',
      entranceFee: 0, membershipFee: 0, active: true, applicantSelectable: false },
    { id: 'inactive', code: 'ASSOCIATE', name: 'Inactive Associate', description: 'Inactive',
      entranceFee: 10, membershipFee: 20, active: false, applicantSelectable: true },
  ];
  const queries = [];
  const service = new MembershipTypesService({ client: { membershipType: {
    async findMany(args) {
      queries.push(args);
      const rows = source
        .filter(row => Object.entries(args.where).every(([field, value]) => row[field] === value))
        .sort((left, right) => left.name.localeCompare(right.name) ||
          left.code.localeCompare(right.code) || left.id.localeCompare(right.id));
      return rows.map(row => Object.fromEntries(Object.keys(args.select).map(field => [field, row[field]])));
    },
  } } });
  return { queries, service };
}

test('approver membership-type route requires ACTIVE final-approver roles', async () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, ReviewerMembershipTypesController),
    [SupabaseJwtGuard, ActiveAccountGuard, RolesGuard]);
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, ReviewerMembershipTypesController), approverRoles);

  const guard = new RolesGuard(new Reflector());
  for (const role of approverRoles) {
    assert.equal(guard.canActivate(context({ principal: principal({ role }) })), true);
  }
  for (const role of deniedRoles) {
    assert.throws(() => guard.canActivate(context({ principal: principal({ role }) })),
      error => error.getStatus() === 403);
  }
  for (const accountStatus of ['SUSPENDED', 'DISABLED', null]) {
    assert.throws(() => new ActiveAccountGuard().canActivate(context({
      principal: principal({ accountStatus }),
    })), error => error.getStatus() === 403);
  }

  const jwt = new SupabaseJwtGuard({ verifyAccessToken: async () => null }, { resolve: async () => ({}) });
  await assert.rejects(jwt.canActivate(context({ headers: {} })), error => error.getStatus() === 401);
});

test('approver query includes active HONORARY, excludes inactive, and returns only safe fields', async () => {
  const database = membershipTypeService();
  const result = await database.service.listApproverTypes();

  assert.deepEqual(database.queries[0], {
    where: { active: true },
    orderBy: [{ name: 'asc' }, { code: 'asc' }, { id: 'asc' }],
    select: { id: true, code: true, name: true },
  });
  assert.deepEqual(result, [
    { id: 'honorary', code: 'HONORARY', name: 'Honorary Member' },
    { id: 'ordinary', code: 'ORDINARY', name: 'Ordinary Member' },
  ]);
  assert(!JSON.stringify(result).includes('description'));
  assert(!JSON.stringify(result).includes('Fee'));
});

test('applicant membership-type behavior remains selectable-only', async () => {
  const database = membershipTypeService();
  const result = await database.service.listApplicantTypes();

  assert.deepEqual(database.queries[0].where, { active: true, applicantSelectable: true });
  assert.deepEqual(result, [{
    id: 'ordinary',
    code: 'ORDINARY',
    name: 'Ordinary Member',
    description: 'Applicant type',
    entranceFee: '100',
    membershipFee: '50',
  }]);
});
