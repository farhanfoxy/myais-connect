import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Test } from '@nestjs/testing';
import { AppModule } from '../dist/app.module.js';
import { PRISMA_CLIENT, PrismaService } from '../dist/database/prisma.service.js';
import { HealthController } from '../dist/health/health.controller.js';
import { validateEnvironment } from '../dist/config/environment.js';
import { canAccessProtectedApi } from '../dist/auth/account-access.js';
import { SupabaseJwtVerifier } from '../dist/auth/supabase-jwt.verifier.js';

const supabaseUrl = 'https://example.supabase.co';

test('DATABASE_URL is mandatory; DIRECT_URL cannot substitute for it', () => {
  for (const env of [{}, { DATABASE_URL: '' }, { DATABASE_URL: ' ' }, { DIRECT_URL: 'postgresql://private:secret@private/db' }])
    assert.throws(() => validateEnvironment(env), { message: 'DATABASE_URL is required' });
  const value = 'postgresql://runtime:synthetic@localhost/runtime';
  assert.equal(validateEnvironment({ DATABASE_URL: value, DIRECT_URL: 'ignored', SUPABASE_URL: supabaseUrl }).databaseUrl, value);
});

test('invalid configuration errors do not disclose values', () => {
  assert.throws(() => validateEnvironment({ DATABASE_URL: 'https://private:secret@private/db' }),
    { message: 'DATABASE_URL must be a valid PostgreSQL connection URL' });
  assert.throws(() => validateEnvironment({ DATABASE_URL: 'postgresql://localhost/db', SUPABASE_URL: supabaseUrl, PORT: 'secret' }),
    { message: 'PORT must be an integer between 1 and 65535' });
});

test('Supabase settings derive issuer and JWKS from one validated origin', () => {
  const databaseUrl = 'postgresql://localhost/myais';
  assert.throws(() => validateEnvironment({ DATABASE_URL: databaseUrl }),
    { message: 'SUPABASE_URL is required' });
  for (const invalid of ['https://user:secret@example.supabase.co', 'https://example.supabase.co/other',
    'https://example.supabase.co?secret=private', 'http://example.supabase.co']) {
    assert.throws(() => validateEnvironment({ DATABASE_URL: databaseUrl, SUPABASE_URL: invalid }),
      { message: 'SUPABASE_URL must be a valid Supabase origin URL' });
  }
  const config = validateEnvironment({ DATABASE_URL: databaseUrl, SUPABASE_URL: `${supabaseUrl}/` });
  assert.equal(config.supabaseUrl, supabaseUrl);
  assert.equal(config.supabaseJwtAudience, 'authenticated');
  assert.equal(config.supabaseJwtIssuer, `${supabaseUrl}/auth/v1`);
  assert.equal(config.supabaseJwksUrl, `${supabaseUrl}/auth/v1/.well-known/jwks.json`);
  assert.equal(validateEnvironment({ DATABASE_URL: databaseUrl, SUPABASE_URL: supabaseUrl,
    SUPABASE_JWT_AUDIENCE: 'custom-audience' }).supabaseJwtAudience, 'custom-audience');
  assert.throws(() => validateEnvironment({ DATABASE_URL: databaseUrl, SUPABASE_URL: supabaseUrl,
    SUPABASE_JWT_AUDIENCE: ' ' }),
  { message: 'SUPABASE_JWT_AUDIENCE must be a non-empty value' });
});

test('protected account status permits ACTIVE only', () => {
  assert.equal(canAccessProtectedApi('ACTIVE'), true);
  for (const status of ['DISABLED', 'SUSPENDED', null, undefined])
    assert.equal(canAccessProtectedApi(status), false);
});

test('Nest module shares one client, runs SELECT 1, and disconnects on shutdown', async () => {
  let queries = 0, disconnects = 0;
  const client = {
    $queryRaw: async (strings, ...values) => {
      assert.deepEqual([...strings], ['SELECT 1']);
      assert.deepEqual(values, []);
      queries++;
      return [{ value: 1 }];
    },
    $disconnect: async () => { disconnects++; },
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PRISMA_CLIENT).useValue(client)
    .overrideProvider(SupabaseJwtVerifier).useValue({ verifyAccessToken: async () => null }).compile();
  await module.init();
  try {
    assert.equal(module.get(PrismaService).client, client);
    const response = await module.get(HealthController).getHealth();
    assert.deepEqual(Object.keys(response).sort(), ['api', 'database', 'timestamp']);
    assert.equal(response.api, 'up');
    assert.equal(response.database, 'up');
    assert.equal(new Date(response.timestamp).toISOString(), response.timestamp);
    assert.equal(queries, 1);
  } finally { await module.close(); }
  assert.equal(disconnects, 1);
});

test('health failure is a safe 503 and a later probe can recover', async () => {
  let down = true;
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PRISMA_CLIENT).useValue({
      $queryRaw: async () => { if (down) throw new Error('postgresql://private:secret@private/db'); return []; },
      $disconnect: async () => {},
    }).overrideProvider(SupabaseJwtVerifier).useValue({ verifyAccessToken: async () => null }).compile();
  try {
    const controller = module.get(HealthController);
    await assert.rejects(controller.getHealth(), error => {
      assert.equal(error.getStatus(), 503);
      const body = error.getResponse();
      assert.equal(body.api, 'up');
      assert.equal(body.database, 'down');
      assert.deepEqual(Object.keys(body).sort(), ['api', 'database', 'timestamp']);
      assert(!JSON.stringify(body).includes('private'));
      return true;
    });
    down = false;
    assert.equal((await controller.getHealth()).database, 'up');
  } finally { await module.close(); }
});
