import { applicationDocumentUploadSchema } from '@myais/validation';
import type { ApiClient, ApplicationDocument, ApplicationDocumentType } from '@/lib/api-client';

export const applicationDocumentMaximumBytes = 5 * 1024 * 1024;
export const applicationDocumentMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export class ApplicationUploadError extends Error {}

export function validateApplicationFile(documentType: ApplicationDocumentType, file: File) {
  const result = applicationDocumentUploadSchema.safeParse({
    documentType, originalFileName: file.name, mimeType: file.type, fileSize: file.size,
  });
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  if (file.size > applicationDocumentMaximumBytes) throw new ApplicationUploadError('Choose a file no larger than 5 MB.');
  if (!applicationDocumentMimeTypes.some(type => type === file.type)) {
    throw new ApplicationUploadError('Choose a PDF, JPEG, JPG or PNG file.');
  }
  throw new ApplicationUploadError(issue?.message || 'Choose a valid document.');
}

export async function uploadApplicationDocument(
  api: ApiClient,
  applicationId: string,
  documentType: ApplicationDocumentType,
  file: File,
  providerFetch: typeof fetch = fetch,
  onStage?: (stage: 'authorizing' | 'uploading' | 'finalizing') => void,
): Promise<ApplicationDocument> {
  const metadata = validateApplicationFile(documentType, file);
  onStage?.('authorizing');
  const target = await api.authorizeApplicationDocumentUpload(applicationId, metadata);
  onStage?.('uploading');
  let uploaded: Response;
  try {
    uploaded = await providerFetch(target.uploadUrl, { method: target.method, headers: target.headers, body: file });
  } catch {
    throw new ApplicationUploadError('The private upload could not be completed. Please try again.');
  }
  if (!uploaded.ok) throw new ApplicationUploadError('The private upload could not be completed. Please try again.');
  onStage?.('finalizing');
  return api.finalizeApplicationDocumentUpload(applicationId, target.uploadToken);
}
