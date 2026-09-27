import { Injectable } from '@nestjs/common';
import type {
  ConfirmedPrivateUpload,
  PrivateDownloadTarget,
  PrivateObjectMetadata,
  PrivateStorage,
  PrivateUploadTarget,
} from './private-storage.js';
import { PrivateStorageUnavailableError } from './private-storage.js';

@Injectable()
export class UnavailablePrivateStorage implements PrivateStorage {
  private unavailable(): never {
    throw new PrivateStorageUnavailableError('Private storage provider is not configured');
  }

  createUploadTarget(): Promise<PrivateUploadTarget> {
    return this.unavailable();
  }

  confirmUpload(): Promise<ConfirmedPrivateUpload> {
    return this.unavailable();
  }

  createDownloadTarget(): Promise<PrivateDownloadTarget> {
    return this.unavailable();
  }

  deleteObject(): Promise<void> {
    return this.unavailable();
  }

  getObjectMetadata(): Promise<PrivateObjectMetadata | null> {
    return this.unavailable();
  }
}
