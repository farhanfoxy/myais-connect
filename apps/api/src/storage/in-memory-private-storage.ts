import { randomUUID } from 'node:crypto';
import type {
  ConfirmedPrivateUpload,
  PrivateDownloadTarget,
  PrivateObjectMetadata,
  PrivateStorage,
  PrivateUploadRequest,
  PrivateUploadTarget,
} from './private-storage.js';
import { PrivateUploadNotFoundError } from './private-storage.js';

interface PendingUpload extends PrivateUploadRequest {
  expiresAt: Date;
  completed?: PrivateObjectMetadata;
}

export class InMemoryPrivateStorage implements PrivateStorage {
  private readonly pending = new Map<string, PendingUpload>();
  private readonly objects = new Map<string, PrivateObjectMetadata>();
  readonly deletedObjectKeys: string[] = [];

  async createUploadTarget(request: PrivateUploadRequest): Promise<PrivateUploadTarget> {
    const uploadToken = randomUUID();
    const expiresAt = new Date(Date.now() + request.expiresInSeconds * 1000);
    this.pending.set(uploadToken, { ...request, context: { ...request.context }, expiresAt });
    return {
      uploadToken,
      uploadUrl: `memory-private-upload://${uploadToken}`,
      method: 'PUT',
      headers: { 'content-type': request.contentType, 'content-length': String(request.contentLength) },
      expiresAt: expiresAt.toISOString(),
    };
  }

  completeUpload(
    uploadToken: string,
    metadata: Partial<Pick<PrivateObjectMetadata, 'contentType' | 'contentLength'>> = {},
  ): void {
    const pending = this.pending.get(uploadToken);
    if (!pending) throw new PrivateUploadNotFoundError('Upload authorization not found');
    const completed = {
      objectKey: pending.objectKey,
      contentType: metadata.contentType ?? pending.contentType,
      contentLength: metadata.contentLength ?? pending.contentLength,
    };
    pending.completed = completed;
    this.objects.set(completed.objectKey, completed);
  }

  async confirmUpload(uploadToken: string): Promise<ConfirmedPrivateUpload> {
    const pending = this.pending.get(uploadToken);
    if (!pending || pending.expiresAt.getTime() <= Date.now() || !pending.completed) {
      throw new PrivateUploadNotFoundError('Uploaded object not found');
    }
    this.pending.delete(uploadToken);
    return { ...pending.completed, context: { ...pending.context } };
  }

  async createDownloadTarget(objectKey: string, expiresInSeconds: number): Promise<PrivateDownloadTarget> {
    if (!this.objects.has(objectKey)) throw new PrivateUploadNotFoundError('Private object not found');
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    return { downloadUrl: `memory-private-download://${randomUUID()}`, expiresAt: expiresAt.toISOString() };
  }

  async deleteObject(objectKey: string): Promise<void> {
    this.objects.delete(objectKey);
    this.deletedObjectKeys.push(objectKey);
  }

  async getObjectMetadata(objectKey: string): Promise<PrivateObjectMetadata | null> {
    return this.objects.get(objectKey) ?? null;
  }
}
