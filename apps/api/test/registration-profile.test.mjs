import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { ActiveAccountGuard } from '../dist/auth/active-account.guard.js';
import { MembershipTypesController } from '../dist/membership-types/membership-types.controller.js';
import { MembershipTypesService } from '../dist/membership-types/membership-types.service.js';
import { ProfileController } from '../dist/profile/profile.controller.js';
import { ProfileService } from '../dist/profile/profile.service.js';
import { SupabaseJwtGuard } from '../dist/auth/supabase-jwt.guard.js';

const ownId = '111e4567-e89b-42d3-a456-426614174000';

function principal(overrides = {}) {
  return { id: ownId, email: 'person@example.test', supabaseAuthUserId: '222e4567-e89b-42d3-a456-426614174000',
    fullName: null, photoUrl: null, role: 'APPLICANT', accountStatus: 'ACTIVE', ...overrides };
}

function validProfile(overrides = {}) {
  return {
    fullName: '  Person   Name  ', identificationType: 'NRIC', identificationNumber: 'ID-1',
    nationality: 'Malaysian', dateOfBirth: '1990-01-31', gender: 'OTHER', phoneNumber: '+60123',
    addressLine1: 'Address', addressLine2: null, city: 'City', state: 'Selangor', postcode: '40000',
    country: 'Malaysia', institution: 'Institution', occupation: 'Occupation', department: 'Department',
    areaOfExpertise: 'Expertise', aisMember: false, ...overrides,
  };
}

function profileDatabase({ existing = null, userId = ownId } = {}) {
  const state = {
    user: { id: userId, email: 'person@example.test', fullName: 'User Name', legacyFullName: 'Legacy Name' },
    profile: existing,
    profileCreates: 0,
    profileUpdates: 0,
    eventName: null,
    audits: [],
  };
  const viewUser = () => ({ ...state.user, memberProfileByUser: state.profile });
  const transaction = {
    memberProfile: {
      async upsert({ where, create, update }) {
        assert.equal(where.userId, userId);
        if (state.profile) {
          state.profile = { ...state.profile, ...update };
          state.profileUpdates++;
        } else {
          state.profile = { id: 'profile-id', ...create };
          state.profileCreates++;
        }
        return { id: state.profile.id };
      },
    },
    user: { async update({ where, data }) { assert.equal(where.id, userId); Object.assign(state.user, data); } },
    eventRegistration: {
      async updateMany({ where, data }) { assert.equal(where.userId, userId); state.eventName = data.attendeeName; return { count: 2 }; },
    },
    auditLog: { async create({ data }) { state.audits.push(data); return data; } },
  };
  const client = {
    user: {
      async findUniqueOrThrow({ where }) {
        assert.equal(where.id, userId);
        return viewUser();
      },
    },
    async $transaction(work) { return work(transaction); },
  };
  return { state, service: new ProfileService({ client }) };
}

test('registration and profile controllers require JWT plus ACTIVE account guards', () => {
  for (const controller of [MembershipTypesController, ProfileController]) {
    assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, controller), [SupabaseJwtGuard, ActiveAccountGuard]);
  }
  const jwt = new SupabaseJwtGuard({ verifyAccessToken: async () => null }, { resolve: async () => principal() });
  const context = request => ({ switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function handler() {}, getClass: () => ProfileController });
  assert.rejects(jwt.canActivate(context({ headers: {} })), error => error.getStatus() === 401);
  for (const accountStatus of ['DISABLED', 'SUSPENDED']) {
    assert.throws(() => new ActiveAccountGuard().canActivate(context({ principal: principal({ accountStatus }) })),
      error => error.getStatus() === 403);
  }
});

test('membership types query excludes inactive/non-selectable records and returns safe fields', async () => {
  const source = [
    { id: 'ordinary', code: 'ORDINARY', name: 'Ordinary', description: 'Description', entranceFee: 10,
      membershipFee: 20, active: true, applicantSelectable: true, legacyBase44Id: 'private' },
    { id: 'inactive', code: 'LIFETIME', active: false, applicantSelectable: true },
    { id: 'hidden', code: 'HONORARY', active: true, applicantSelectable: false },
  ];
  let query;
  const service = new MembershipTypesService({ client: { membershipType: {
    async findMany(args) {
      query = args;
      return source.filter(row => row.active === args.where.active &&
        row.applicantSelectable === args.where.applicantSelectable).map(row => {
        const selected = {};
        for (const field of Object.keys(args.select)) selected[field] = row[field];
        return selected;
      });
    },
  } } });
  const result = await service.listApplicantTypes();
  assert.deepEqual(query.where, { active: true, applicantSelectable: true });
  assert.deepEqual(result, [{ id: 'ordinary', code: 'ORDINARY', name: 'Ordinary', description: 'Description',
    entranceFee: '10', membershipFee: '20' }]);
  assert(!JSON.stringify(result).includes('private'));
});

test('no profile returns safe initialization with profile/User/legacy name priority', async () => {
  const database = profileDatabase();
  const result = await database.service.getOwn(ownId);
  assert.equal(result.exists, false);
  assert.equal(result.email, 'person@example.test');
  assert.equal(result.profile.fullName, 'User Name');
  assert.equal(result.profile.aisMember, false);
  assert.equal(result.profile.profileCompletionPercentage, 0);
  assert(!JSON.stringify(result).includes(ownId));
  assert(!JSON.stringify(result).includes('Legacy Name'));

  database.state.user.fullName = null;
  assert.equal((await database.service.getOwn(ownId)).profile.fullName, 'Legacy Name');
  database.state.profile = { ...validProfile(), fullName: 'Profile Name', dateOfBirth: new Date('1990-01-31T00:00:00Z'),
    aisMembershipExpiry: null, profileCompletionPercentage: 1 };
  const existing = await database.service.getOwn(ownId);
  assert.equal(existing.profile.fullName, 'Profile Name');
  assert.equal(existing.profile.profileCompletionPercentage, 100);
});

test('profile validation enforces name, required fields, enums, calendar dates, AIS conditions and rejects userId', async () => {
  const { service } = profileDatabase();
  const invalidInputs = [
    validProfile({ fullName: ' x ' }),
    validProfile({ identificationType: 'DRIVER_LICENSE' }),
    validProfile({ gender: 'UNKNOWN' }),
    validProfile({ dateOfBirth: '2025-02-30' }),
    validProfile({ aisMember: true }),
    validProfile({ aisMember: true, aisMembershipNumber: 'AIS-1' }),
    { ...validProfile(), userId: '333e4567-e89b-42d3-a456-426614174000' },
  ];
  for (const field of ['identificationType', 'identificationNumber', 'nationality', 'dateOfBirth', 'gender',
    'phoneNumber', 'addressLine1', 'city', 'state', 'postcode', 'country', 'institution', 'occupation',
    'department', 'areaOfExpertise', 'aisMember']) {
    const input = validProfile();
    delete input[field];
    invalidInputs.push(input);
  }
  for (const input of invalidInputs) {
    await assert.rejects(service.upsertOwn(ownId, input), error => error.getStatus() === 400);
  }
  await assert.doesNotReject(service.upsertOwn(ownId, validProfile()));
});

test('profile create/update owns userId, computes 100%, synchronizes names, and audits transactionally', async () => {
  const database = profileDatabase();
  const created = await database.service.upsertOwn(ownId, validProfile());
  assert.equal(database.state.profileCreates, 1);
  assert.equal(database.state.profileUpdates, 0);
  assert.equal(database.state.profile.userId, ownId);
  assert.equal(database.state.profile.profileCompletionPercentage, 100);
  assert.equal(database.state.user.fullName, 'Person Name');
  assert.equal(database.state.eventName, 'Person Name');
  assert.equal(database.state.audits.length, 1);
  assert.equal(database.state.audits[0].actorUserId, ownId);
  assert.equal(database.state.audits[0].action, 'PROFILE_NAME_SYNCED');
  assert.equal(created.profile.dateOfBirth, '1990-01-31');

  await database.service.upsertOwn(ownId, validProfile({ fullName: 'Updated Name', addressLine2: 'Line 2' }));
  assert.equal(database.state.profileCreates, 1);
  assert.equal(database.state.profileUpdates, 1);
  assert.equal(database.state.user.fullName, 'Updated Name');
  assert.equal(database.state.audits.length, 2);
  assert(!JSON.stringify(created).includes('legacyBase44Id'));
  assert(!JSON.stringify(created).includes('supabaseAuthUserId'));
});
