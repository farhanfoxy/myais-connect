import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateEnvironment } from '../dist/config/environment.js';
import {
  PrivateStorageUnavailableError,
  PrivateUploadMetadataMismatchError,
  PrivateUploadNotFoundError,
} from '../dist/storage/private-storage.js';
import { selectPrivateStorage } from '../dist/storage/storage.module.js';
import { SupabasePrivateStorage } from '../dist/storage/supabase-private-storage.js';
import { UnavailablePrivateStorage } from '../dist/storage/unavailable-private-storage.js';

const supabaseUrl = 'https://example.supabase.co';
const bucket = 'myais-private';
const serviceRoleKey = 'server-only-service-role-key';
const objectKey = 'applications/11111111-1111-4111-8111-111111111111/opaque-object-1';

function providerFixture(options = {}) {
  const calls = [];
  const metadata = options.metadata ?? {
    name: objectKey,
    size: 512,
    contentType: 'application/pdf',
  };
  const bucketProvider = {
    async createSignedUploadUrl(path, uploadOptions) {
      calls.push({ operation: 'createSignedUploadUrl', path, options: uploadOptions });
      if (options.uploadError) return { data: null, error: options.uploadError };
      return {
        data: {
          signedUrl: options.uploadUrl ??
            `${supabaseUrl}/storage/v1/object/upload/sign/${bucket}/${path}?token=provider-upload-token`,
          token: 'provider-upload-token',
          path,
        },
        error: null,
      };
    },
    async info(path) {
      calls.push({ operation: 'info', path });
      if (options.infoError) return { data: null, error: options.infoError };
      return { data: metadata, error: null };
    },
    async createSignedUrl(path, expiresIn) {
      calls.push({ operation: 'createSignedUrl', path, expiresIn });
      if (options.downloadError) return { data: null, error: options.downloadError };
      return {
        data: {
          signedUrl: `${supabaseUrl}/storage/v1/object/sign/${bucket}/${path}?token=provider-download-token`,
        },
        error: null,
      };
    },
    async remove(paths) {
      calls.push({ operation: 'remove', paths });
      if (options.deleteError) return { data: null, error: options.deleteError };
      return { data: [], error: null };
    },
  };
  return {
    calls,
    provider: {
      from(selectedBucket) {
        calls.push({ operation: 'from', bucket: selectedBucket });
        return bucketProvider;
      },
    },
  };
}

function adapter(fixture = providerFixture()) {
  return {
    fixture,
    storage: new SupabasePrivateStorage({ supabaseUrl, bucket, serviceRoleKey }, fixture.provider),
  };
}

const request = {
  objectKey,
  contentType: 'application/pdf',
  contentLength: 512,
  expiresInSeconds: 300,
  context: { kind: 'application-document', userId: 'user-1' },
};

test('storage selection uses Supabase only when complete server configuration exists', async () => {
  const base = { DATABASE_URL: 'postgresql://localhost/myais', SUPABASE_URL: supabaseUrl,
    WEB_ALLOWED_ORIGINS: 'http://localhost:3000' };
  const configured = selectPrivateStorage(validateEnvironment({
    ...base,
    SUPABASE_STORAGE_BUCKET: bucket,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  }));
  assert(configured instanceof SupabasePrivateStorage);

  for (const environment of [base, { ...base, SUPABASE_STORAGE_BUCKET: bucket }, {
    ...base,
    SUPABASE_STORAGE_BUCKET: '../unsafe',
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  }]) {
    const unavailable = selectPrivateStorage(validateEnvironment(environment));
    assert(unavailable instanceof UnavailablePrivateStorage);
    await assert.rejects(async () => unavailable.getObjectMetadata(objectKey), PrivateStorageUnavailableError);
  }
});

test('upload authorization is scoped to the exact server object key and uses an opaque app token', async () => {
  const { storage, fixture } = adapter();
  const before = Date.now();
  const target = await storage.createUploadTarget(request);
  const authorization = fixture.calls.find(call => call.operation === 'createSignedUploadUrl');
  assert.deepEqual(authorization, {
    operation: 'createSignedUploadUrl',
    path: objectKey,
    options: { upsert: false },
  });
  assert.equal(target.method, 'PUT');
  assert.equal(target.headers['content-type'], 'application/pdf');
  assert.equal(target.headers['x-upsert'], 'false');
  assert(!target.uploadToken.includes(objectKey));
  assert(!JSON.stringify(target.headers).includes(serviceRoleKey));
  assert.match(target.uploadUrl, /\/object\/upload\/sign\//);
  assert(!target.uploadUrl.includes('/object/public/'));
  const expiry = Date.parse(target.expiresAt);
  assert(expiry >= before + 299_000 && expiry <= Date.now() + 301_000);
});

test('invalid or client-shaped object paths are rejected before the provider is called', async () => {
  const { storage, fixture } = adapter();
  for (const path of ['../escape', '/absolute/object', 'https://legacy.example/file.pdf', 'folder//object']) {
    await assert.rejects(storage.createUploadTarget({ ...request, objectKey: path }),
      PrivateStorageUnavailableError);
  }
  assert.deepEqual(fixture.calls.map(call => call.operation), ['from']);
});

test('finalization decrypts context and verifies provider object metadata', async () => {
  const { storage, fixture } = adapter();
  const target = await storage.createUploadTarget(request);
  const confirmed = await storage.confirmUpload(target.uploadToken);
  assert.deepEqual(confirmed, {
    objectKey,
    contentType: 'application/pdf',
    contentLength: 512,
    context: request.context,
  });
  assert(fixture.calls.some(call => call.operation === 'info' && call.path === objectKey));
});

test('missing and mismatched uploads cannot finalize', async () => {
  const missing = adapter(providerFixture({ infoError: { status: 404, code: 'NoSuchKey' } }));
  const missingTarget = await missing.storage.createUploadTarget(request);
  await assert.rejects(missing.storage.confirmUpload(missingTarget.uploadToken), PrivateUploadNotFoundError);

  const mismatched = adapter(providerFixture({
    metadata: { name: objectKey, size: 513, contentType: 'image/png' },
  }));
  const mismatchTarget = await mismatched.storage.createUploadTarget(request);
  await assert.rejects(mismatched.storage.confirmUpload(mismatchTarget.uploadToken),
    PrivateUploadMetadataMismatchError);
  assert.deepEqual(mismatched.fixture.calls.find(call => call.operation === 'remove')?.paths, [objectKey]);
});

test('download authorization checks existence and preserves the five-minute lifetime', async () => {
  const { storage, fixture } = adapter();
  const before = Date.now();
  const target = await storage.createDownloadTarget(objectKey, 300);
  assert.match(target.downloadUrl, /\/object\/sign\//);
  assert(!target.downloadUrl.includes('/object/public/'));
  assert.deepEqual(fixture.calls.find(call => call.operation === 'createSignedUrl'), {
    operation: 'createSignedUrl',
    path: objectKey,
    expiresIn: 300,
  });
  const expiry = Date.parse(target.expiresAt);
  assert(expiry >= before + 299_000 && expiry <= Date.now() + 301_000);
});

test('deletion sends only the exact opaque key and treats provider not-found as idempotent', async () => {
  const exact = adapter();
  await exact.storage.deleteObject(objectKey);
  assert.deepEqual(exact.fixture.calls.find(call => call.operation === 'remove')?.paths, [objectKey]);

  const absent = adapter(providerFixture({ deleteError: { status: 404, code: 'NoSuchKey' } }));
  await absent.storage.deleteObject(objectKey);
});

test('provider failures are sanitized and untrusted signed URLs are rejected', async () => {
  const secret = 'raw-provider-secret-payload';
  const failed = adapter(providerFixture({ uploadError: { status: 503, message: secret } }));
  await assert.rejects(failed.storage.createUploadTarget(request), error => {
    assert(error instanceof PrivateStorageUnavailableError);
    assert(!error.message.includes(secret));
    assert(!error.message.includes(bucket));
    return true;
  });

  const external = providerFixture({ uploadUrl: 'https://attacker.example/upload?token=secret' });
  const unsafe = new SupabasePrivateStorage({ supabaseUrl, bucket, serviceRoleKey }, external.provider);
  await assert.rejects(unsafe.createUploadTarget(request), PrivateStorageUnavailableError);

  const wrongObject = providerFixture({
    uploadUrl: `${supabaseUrl}/storage/v1/object/upload/sign/${bucket}/other-object?token=secret`,
  });
  const wronglyScoped = new SupabasePrivateStorage({ supabaseUrl, bucket, serviceRoleKey }, wrongObject.provider);
  await assert.rejects(wronglyScoped.createUploadTarget(request), PrivateStorageUnavailableError);
});

test('legacy external URLs are never interpreted as native provider keys', async () => {
  const { storage, fixture } = adapter();
  await assert.rejects(storage.createDownloadTarget('https://legacy.example/private-token', 300),
    PrivateStorageUnavailableError);
  await assert.rejects(storage.deleteObject('https://legacy.example/private-token'),
    PrivateStorageUnavailableError);
  assert.deepEqual(fixture.calls.map(call => call.operation), ['from']);
});
