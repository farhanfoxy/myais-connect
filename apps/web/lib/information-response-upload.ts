import { informationRequestAttachmentUploadSchema } from '@myais/validation';
import type { ApiClient } from '@/lib/api-client';

export const informationAttachmentMaximumBytes = 5 * 1024 * 1024;
export const informationAttachmentMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export class InformationAttachmentError extends Error {}

export function validateInformationAttachment(file: File) {
  const result = informationRequestAttachmentUploadSchema.safeParse({
    originalFileName: file.name, mimeType: file.type, fileSize: file.size,
  });
  if (result.success) return result.data;
  if (file.size > informationAttachmentMaximumBytes) {
    throw new InformationAttachmentError('Choose a file no larger than 5 MB.');
  }
  if (!informationAttachmentMimeTypes.some(type => type === file.type)) {
    throw new InformationAttachmentError('Choose a PDF, JPEG, JPG or PNG file.');
  }
  throw new InformationAttachmentError(result.error.issues[0]?.message || 'Choose a valid attachment.');
}

export async function uploadInformationAttachment(
  api: ApiClient,
  applicationId: string,
  requestId: string,
  file: File,
  providerFetch: typeof fetch = fetch,
  onStage?: (stage: 'authorizing' | 'uploading') => void,
): Promise<string> {
  const metadata = validateInformationAttachment(file);
  onStage?.('authorizing');
  const target = await api.authorizeInformationResponseUpload(applicationId, requestId, metadata);
  onStage?.('uploading');
  let uploaded: Response;
  try {
    uploaded = await providerFetch(target.uploadUrl, {
      method: target.method, headers: target.headers, body: file,
    });
  } catch {
    throw new InformationAttachmentError('The private upload could not be completed. Please try again.');
  }
  if (!uploaded.ok) {
    throw new InformationAttachmentError('The private upload could not be completed. Please try again.');
  }
  return target.uploadToken;
}
