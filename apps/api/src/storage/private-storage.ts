export const PRIVATE_STORAGE = Symbol('PRIVATE_STORAGE');

export interface PrivateUploadRequest {
  objectKey: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds: number;
  context: Record<string, string>;
}

export interface PrivateUploadTarget {
  uploadToken: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

export interface ConfirmedPrivateUpload {
  objectKey: string;
  contentType: string;
  contentLength: number;
  context: Record<string, string>;
}

export interface PrivateDownloadTarget {
  downloadUrl: string;
  expiresAt: string;
}

export interface PrivateObjectMetadata {
  objectKey: string;
  contentType: string;
  contentLength: number;
}

export interface PrivateStorage {
  createUploadTarget(request: PrivateUploadRequest): Promise<PrivateUploadTarget>;
  confirmUpload(uploadToken: string): Promise<ConfirmedPrivateUpload>;
  createDownloadTarget(objectKey: string, expiresInSeconds: number): Promise<PrivateDownloadTarget>;
  deleteObject(objectKey: string): Promise<void>;
  getObjectMetadata(objectKey: string): Promise<PrivateObjectMetadata | null>;
}

export class PrivateStorageUnavailableError extends Error {}
export class PrivateUploadNotFoundError extends Error {}
