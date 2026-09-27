import { createHash, randomUUID } from 'node:crypto';
import { StorageClient } from '@supabase/storage-js';
import { EncryptJWT, jwtDecrypt } from 'jose';
import type {
  ConfirmedPrivateUpload,
  PrivateDownloadTarget,
  PrivateObjectMetadata,
  PrivateStorage,
  PrivateUploadRequest,
  PrivateUploadTarget,
} from './private-storage.js';
import {
  PrivateStorageUnavailableError,
  PrivateUploadMetadataMismatchError,
  PrivateUploadNotFoundError,
} from './private-storage.js';

const uploadTokenIssuer = 'myais-private-storage';
const uploadTokenAudience = 'myais-private-upload-finalization';

export interface SupabasePrivateStorageConfig {
  supabaseUrl: string;
  bucket: string;
  serviceRoleKey: string;
}

type SupabaseBucketProvider = Pick<
  ReturnType<StorageClient['from']>,
  'createSignedUploadUrl' | 'createSignedUrl' | 'info' | 'remove'
>;

export interface SupabaseStorageProvider {
  from(bucket: string): SupabaseBucketProvider;
}

interface UploadTokenPayload {
  objectKey: string;
  contentType: string;
  contentLength: number;
  context: Record<string, string>;
}

export class SupabasePrivateStorage implements PrivateStorage {
  private readonly bucketProvider: SupabaseBucketProvider;
  private readonly tokenKey: Uint8Array;
  private readonly storageBaseUrl: URL;

  constructor(
    private readonly configuration: SupabasePrivateStorageConfig,
    provider?: SupabaseStorageProvider,
  ) {
    this.storageBaseUrl = new URL('/storage/v1/', configuration.supabaseUrl);
    const storageProvider: SupabaseStorageProvider = provider ?? new StorageClient(
      this.storageBaseUrl.toString(),
      {
        apikey: configuration.serviceRoleKey,
        Authorization: `Bearer ${configuration.serviceRoleKey}`,
      },
    );
    this.bucketProvider = storageProvider.from(configuration.bucket);
    this.tokenKey = createHash('sha256')
      .update('myais-private-upload-token\0', 'utf8')
      .update(configuration.serviceRoleKey, 'utf8')
      .digest();
  }

  async createUploadTarget(request: PrivateUploadRequest): Promise<PrivateUploadTarget> {
    this.assertObjectKey(request.objectKey);
    if (!Number.isInteger(request.expiresInSeconds) || request.expiresInSeconds < 1) {
      throw new PrivateStorageUnavailableError('Private storage request could not be authorized');
    }
    const result = await this.bucketProvider.createSignedUploadUrl(request.objectKey, { upsert: false });
    if (result.error || !result.data) {
      throw new PrivateStorageUnavailableError('Private storage upload authorization is unavailable');
    }
    const uploadUrl = this.authorizedSignedUrl(
      result.data.signedUrl,
      'object/upload/sign',
      request.objectKey,
    );
    const payload: UploadTokenPayload = {
      objectKey: request.objectKey,
      contentType: request.contentType,
      contentLength: request.contentLength,
      context: { ...request.context },
    };
    const uploadToken = await new EncryptJWT({ ...payload })
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .setIssuer(uploadTokenIssuer)
      .setAudience(uploadTokenAudience)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${request.expiresInSeconds}s`)
      .encrypt(this.tokenKey);
    return {
      uploadToken,
      uploadUrl,
      method: 'PUT',
      headers: {
        'content-type': request.contentType,
        'x-upsert': 'false',
      },
      expiresAt: new Date(Date.now() + request.expiresInSeconds * 1000).toISOString(),
    };
  }

  async confirmUpload(uploadToken: string): Promise<ConfirmedPrivateUpload> {
    const payload = await this.readUploadToken(uploadToken);
    const metadata = await this.getObjectMetadata(payload.objectKey);
    if (!metadata) throw new PrivateUploadNotFoundError('Uploaded object not found');
    if (metadata.contentType !== payload.contentType || metadata.contentLength !== payload.contentLength) {
      await this.deleteObject(payload.objectKey);
      throw new PrivateUploadMetadataMismatchError('Uploaded object metadata does not match authorization');
    }
    return { ...metadata, context: { ...payload.context } };
  }

  async createDownloadTarget(objectKey: string, expiresInSeconds: number): Promise<PrivateDownloadTarget> {
    this.assertObjectKey(objectKey);
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1) {
      throw new PrivateStorageUnavailableError('Private storage download authorization is unavailable');
    }
    if (!await this.getObjectMetadata(objectKey)) {
      throw new PrivateUploadNotFoundError('Private object not found');
    }
    const result = await this.bucketProvider.createSignedUrl(objectKey, expiresInSeconds);
    if (result.error || !result.data) {
      if (this.isNotFound(result.error)) throw new PrivateUploadNotFoundError('Private object not found');
      throw new PrivateStorageUnavailableError('Private storage download authorization is unavailable');
    }
    return {
      downloadUrl: this.authorizedSignedUrl(result.data.signedUrl, 'object/sign', objectKey),
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    };
  }

  async deleteObject(objectKey: string): Promise<void> {
    this.assertObjectKey(objectKey);
    const result = await this.bucketProvider.remove([objectKey]);
    if (result.error && !this.isNotFound(result.error)) {
      throw new PrivateStorageUnavailableError('Private storage object could not be deleted');
    }
  }

  async getObjectMetadata(objectKey: string): Promise<PrivateObjectMetadata | null> {
    this.assertObjectKey(objectKey);
    const result = await this.bucketProvider.info(objectKey);
    if (result.error || !result.data) {
      if (this.isNotFound(result.error)) return null;
      throw new PrivateStorageUnavailableError('Private storage metadata is unavailable');
    }
    const contentLength = result.data.size;
    const contentType = result.data.contentType;
    if (!Number.isSafeInteger(contentLength) || (contentLength ?? -1) < 0 || !contentType?.trim()) {
      throw new PrivateStorageUnavailableError('Private storage metadata is unavailable');
    }
    return {
      objectKey,
      contentType,
      contentLength: contentLength as number,
    };
  }

  private async readUploadToken(uploadToken: string): Promise<UploadTokenPayload> {
    try {
      const { payload } = await jwtDecrypt(uploadToken, this.tokenKey, {
        issuer: uploadTokenIssuer,
        audience: uploadTokenAudience,
      });
      if (typeof payload.objectKey !== 'string' || typeof payload.contentType !== 'string' ||
          !Number.isSafeInteger(payload.contentLength) || (payload.contentLength as number) < 1 ||
          !this.isStringRecord(payload.context)) throw new Error('Invalid upload token');
      this.assertObjectKey(payload.objectKey);
      return {
        objectKey: payload.objectKey,
        contentType: payload.contentType,
        contentLength: payload.contentLength as number,
        context: payload.context,
      };
    } catch {
      throw new PrivateUploadNotFoundError('Upload authorization not found');
    }
  }

  private authorizedSignedUrl(
    input: string,
    operation: 'object/upload/sign' | 'object/sign',
    objectKey: string,
  ): string {
    try {
      const signedUrl = new URL(input);
      const encodedObjectKey = objectKey.split('/').map(segment => encodeURIComponent(segment)).join('/');
      const expectedPath = `${this.storageBaseUrl.pathname}${operation}/` +
        `${encodeURIComponent(this.configuration.bucket)}/${encodedObjectKey}`;
      if (signedUrl.origin !== this.storageBaseUrl.origin || signedUrl.pathname !== expectedPath ||
          signedUrl.protocol !== this.storageBaseUrl.protocol || !signedUrl.searchParams.has('token')) throw new Error();
      return signedUrl.toString();
    } catch {
      throw new PrivateStorageUnavailableError('Private storage authorization is unavailable');
    }
  }

  private assertObjectKey(objectKey: string): void {
    const segments = objectKey.split('/');
    if (objectKey.length < 1 || objectKey.length > 512 || objectKey.startsWith('/') || objectKey.endsWith('/') ||
        segments.some(segment => !segment || segment === '.' || segment === '..' ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment))) {
      throw new PrivateStorageUnavailableError('Private storage request could not be authorized');
    }
  }

  private isStringRecord(value: unknown): value is Record<string, string> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) &&
      Object.values(value).every(item => typeof item === 'string');
  }

  private isNotFound(error: { status?: number; statusCode?: string; code?: string } | null): boolean {
    return error?.status === 404 || error?.statusCode === '404' || error?.code === 'NoSuchKey';
  }
}
