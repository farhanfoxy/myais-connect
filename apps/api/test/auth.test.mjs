import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { validateEnvironment } from '../dist/config/environment.js';
import { SupabaseJwtVerifier } from '../dist/auth/supabase-jwt.verifier.js';
import { SupabaseJwtGuard } from '../dist/auth/supabase-jwt.guard.js';
import { ActiveAccountGuard } from '../dist/auth/active-account.guard.js';
import { CanonicalUserService } from '../dist/auth/canonical-user.service.js';
import { RolesGuard } from '../dist/auth/roles.guard.js';
import { Roles } from '../dist/auth/roles.decorator.js';
import { AuthController } from '../dist/auth/auth.controller.js';

const userId = '123e4567-e89b-42d3-a456-426614174000';
const otherId = '123e4567-e89b-42d3-a456-426614174001';
const config = validateEnvironment({ DATABASE_URL: 'postgresql://localhost/myais',
  SUPABASE_URL: 'https://example.supabase.co' });

function account(overrides = {}) {
  return { id: '111e4567-e89b-42d3-a456-426614174000', email: 'person@example.test',
    supabaseAuthUserId: null, fullName: null, photoUrl: null, role: 'APPLICANT',
    accountStatus: 'ACTIVE', legacyBase44Id: 'private-legacy-id', ...overrides };
}

function context(request, handler = function noop() {}, controller = AuthController) {
  return { switchToHttp: () => ({ getRequest: () => request }), getHandler: () => handler,
    getClass: () => controller };
}

function memoryDatabase(initial = []) {
  const rows = initial.map(record => ({ ...record }));
  let creates = 0;
  let updates = 0;
  const user = {
    async findUnique({ where }) {
      const [field, value] = Object.entries(where)[0];
      return rows.find(row => row[field] === value) ?? null;
    },
    async updateMany({ where, data }) {
      const row = rows.find(value => value.id === where.id && value.accountStatus === where.accountStatus &&
        value.supabaseAuthUserId === where.supabaseAuthUserId);
      if (!row) return { count: 0 };
      Object.assign(row, data); updates++;
      return { count: 1 };
    },
    async create({ data }) {
      if (rows.some(row => row.email === data.email || row.supabaseAuthUserId === data.supabaseAuthUserId))
        throw { code: 'P2002' };
      creates++;
      const row = account({ ...data, id: `222e4567-e89b-42d3-a456-42661417400${creates}` });
      rows.push(row);
      return row;
    },
  };
  const client = { user,
    async $queryRaw(strings, email) {
      if (String(strings[0]).includes('pg_advisory_xact_lock')) return [];
      return rows.filter(row => row.email?.trim().toLowerCase() === email).slice(0, 2)
        .map(row => ({ id: row.id }));
    },
    async $transaction(work) { return work(client); },
  };
  return { rows, client, counts: () => ({ creates, updates }) };
}

test('verifier checks signature, issuer, audience, expiry and UUID sub with local JWKS', async () => {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const publicJwk = await exportJWK(publicKey);
  const verifier = new SupabaseJwtVerifier(config, createLocalJWKSet({ keys: [{ ...publicJwk,
    alg: 'ES256', kid: 'local-test-key' }] }));
  const sign = (claims = {}, issuer = config.supabaseJwtIssuer, audience = config.supabaseJwtAudience,
    key = privateKey) => new SignJWT({ email: 'person@example.test', ...claims })
    .setProtectedHeader({ alg: 'ES256', kid: 'local-test-key' })
    .setIssuer(issuer).setAudience(audience).setSubject(claims.sub ?? userId)
    .setExpirationTime(claims.exp ?? '1h').sign(key);
  assert.deepEqual(await verifier.verifyAccessToken(await sign()),
    { supabaseAuthUserId: userId, email: 'person@example.test' });
  const { privateKey: wrongKey } = await generateKeyPair('ES256');
  for (const token of [await sign({}, 'https://wrong.example/auth/v1'),
    await sign({}, config.supabaseJwtIssuer, 'wrong'), await sign({ exp: '-1s' }),
    await sign({ sub: 'not-a-uuid' }), await sign({}, config.supabaseJwtIssuer,
      config.supabaseJwtAudience, wrongKey)]) {
    await assert.rejects(verifier.verifyAccessToken(token), error => error.getStatus() === 401);
  }
});

test('missing and invalid bearer tokens are 401', async () => {
  const resolver = { resolve: async () => { throw new Error('should not be called'); } };
  const guard = new SupabaseJwtGuard({ verifyAccessToken: async () => { throw new Error('private JWT detail'); } }, resolver);
  for (const authorization of [undefined, 'not-a-bearer', 'Bearer ', 'Bearer abc def', 'Bearer invalid']) {
    await assert.rejects(guard.canActivate(context({ headers: { authorization } })), error =>
      error.getStatus() === 401 && !JSON.stringify(error.getResponse()).includes('private'));
  }
});

test('linked user wins over email matching and ACTIVE can access', async () => {
  const linked = account({ supabaseAuthUserId: userId, email: 'original@example.test' });
  const db = memoryDatabase([linked, account({ id: otherId, email: 'person@example.test' })]);
  const service = new CanonicalUserService({ client: db.client });
  const guard = new SupabaseJwtGuard({ verifyAccessToken: async () => ({
    supabaseAuthUserId: userId, email: 'person@example.test' }) }, service);
  const request = { headers: { authorization: 'Bearer local-valid-token' } };
  assert.equal(await guard.canActivate(context(request)), true);
  assert.equal(request.principal.id, linked.id);
  assert.equal(new ActiveAccountGuard().canActivate(context(request)), true);
  assert.deepEqual(db.counts(), { creates: 0, updates: 0 });
});

test('DISABLED, SUSPENDED and null linked users are denied with 403', async () => {
  for (const accountStatus of ['DISABLED', 'SUSPENDED', null]) {
    const db = memoryDatabase([account({ supabaseAuthUserId: userId, accountStatus })]);
    const principal = await new CanonicalUserService({ client: db.client }).resolve({
      supabaseAuthUserId: userId, email: 'person@example.test' });
    assert.throws(() => new ActiveAccountGuard().canActivate(context({ principal })),
      error => error.getStatus() === 403);
  }
});

test('one ACTIVE normalized email match links; disabled historical matches never link', async () => {
  const active = memoryDatabase([account({ email: ' Person@Example.Test ' })]);
  const service = new CanonicalUserService({ client: active.client });
  assert.equal((await service.resolve({ supabaseAuthUserId: userId, email: 'PERSON@example.test' })).supabaseAuthUserId, userId);
  assert.deepEqual(active.counts(), { creates: 0, updates: 1 });
  for (const status of ['DISABLED', 'SUSPENDED', null]) {
    const historical = account({ email: 'person@example.test', accountStatus: status,
      legacyBase44Id: 'historical', supabaseAuthUserId: null });
    const db = memoryDatabase([historical]);
    await assert.rejects(new CanonicalUserService({ client: db.client }).resolve({
      supabaseAuthUserId: userId, email: 'person@example.test' }), error => error.getStatus() === 403);
    assert.equal(historical.supabaseAuthUserId, null);
    assert.deepEqual(db.counts(), { creates: 0, updates: 0 });
  }
});

test('no match creates APPLICANT + ACTIVE and repeat request does not duplicate', async () => {
  const db = memoryDatabase();
  const service = new CanonicalUserService({ client: db.client });
  const identity = { supabaseAuthUserId: userId, email: ' Person@Example.Test ' };
  const created = await service.resolve(identity);
  assert.equal(created.role, 'APPLICANT');
  assert.equal(created.accountStatus, 'ACTIVE');
  assert.equal(created.email, 'person@example.test');
  assert.equal(created.supabaseAuthUserId, userId);
  assert.equal((await service.resolve(identity)).id, created.id);
  assert.deepEqual(db.counts(), { creates: 1, updates: 0 });
});

test('ambiguous normalized email refuses linking or provisioning', async () => {
  const db = memoryDatabase([account({ email: 'Person@example.test' }),
    account({ id: otherId, email: 'person@example.test' })]);
  await assert.rejects(new CanonicalUserService({ client: db.client }).resolve({
    supabaseAuthUserId: userId, email: 'person@example.test' }), error => error.getStatus() === 403);
  assert.deepEqual(db.counts(), { creates: 0, updates: 0 });
});

test('unique-race retry adopts the same verified identity without creating another row', async () => {
  const db = memoryDatabase();
  const originalTransaction = db.client.$transaction.bind(db.client);
  let first = true;
  db.client.$transaction = async work => {
    if (first) {
      first = false;
      db.rows.push(account({ supabaseAuthUserId: userId }));
      throw { code: 'P2002', message: 'private database detail' };
    }
    return originalTransaction(work);
  };
  const principal = await new CanonicalUserService({ client: db.client }).resolve({
    supabaseAuthUserId: userId, email: 'person@example.test' });
  assert.equal(principal.supabaseAuthUserId, userId);
  assert.deepEqual(db.counts(), { creates: 0, updates: 0 });
  assert.equal(db.rows.length, 1);
});

test('RolesGuard uses canonical role, allows unrestricted ACTIVE, and denies missing roles', () => {
  const guard = new RolesGuard(new Reflector());
  const handler = function protectedEndpoint() {};
  Roles('TREASURER')(handler);
  const principal = account({ supabaseAuthUserId: userId, role: 'TREASURER' });
  assert.equal(guard.canActivate(context({ principal }, handler)), true);
  assert.equal(guard.canActivate(context({ principal }, function noRole() {})), true);
  for (const role of ['APPLICANT', null]) {
    assert.throws(() => guard.canActivate(context({ principal: { ...principal, role } }, handler)),
      error => error.getStatus() === 403);
  }
  assert.throws(() => guard.canActivate(context({ principal: { ...principal, accountStatus: 'SUSPENDED' } }, handler)),
    error => error.getStatus() === 403);
});

test('/auth/me has JWT and ACTIVE guards, returns only safe client fields', () => {
  const guards = Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.me);
  assert.deepEqual(guards, [SupabaseJwtGuard, ActiveAccountGuard]);
  const response = new AuthController().me(account({ supabaseAuthUserId: userId }));
  assert.deepEqual(Object.keys(response).sort(),
    ['accountStatus', 'email', 'fullName', 'id', 'photoUrl', 'role']);
  assert(!JSON.stringify(response).includes('private-legacy-id'));
  assert(!JSON.stringify(response).includes(userId));
});
