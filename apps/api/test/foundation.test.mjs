import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Test } from '@nestjs/testing';
import { AppModule } from '../dist/app.module.js';
import { PRISMA_CLIENT, PrismaService } from '../dist/database/prisma.service.js';
import { HealthController } from '../dist/health/health.controller.js';
import { validateEnvironment } from '../dist/config/environment.js';

test('DATABASE_URL is mandatory; DIRECT_URL cannot substitute for it', () => {
  for (const env of [{}, { DATABASE_URL: '' }, { DATABASE_URL: ' ' }, { DIRECT_URL: 'postgresql://private:secret@private/db' }])
    assert.throws(() => validateEnvironment(env), { message: 'DATABASE_URL is required' });
  const value = 'postgresql://runtime:synthetic@localhost/runtime';
  assert.equal(validateEnvironment({ DATABASE_URL: value, DIRECT_URL: 'ignored' }).databaseUrl, value);
});

test('invalid configuration errors do not disclose values', () => {
  assert.throws(() => validateEnvironment({ DATABASE_URL: 'https://private:secret@private/db' }),
    { message: 'DATABASE_URL must be a valid PostgreSQL connection URL' });
  assert.throws(() => validateEnvironment({ DATABASE_URL: 'postgresql://localhost/db', PORT: 'secret' }),
    { message: 'PORT must be an integer between 1 and 65535' });
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
    .overrideProvider(PRISMA_CLIENT).useValue(client).compile();
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
    }).compile();
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
