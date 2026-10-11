import { profilePhotoUploadSchema } from '@myais/validation';
import type { ApiClient, MemberProfileResponse } from '@/lib/api-client';

export const profilePhotoAccept = 'image/jpeg,image/png,image/webp';
const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;

export class ProfilePhotoUploadError extends Error {}

export function validateProfilePhoto(file: File): string | null {
  const result = profilePhotoUploadSchema.safeParse({
    originalFileName: file.name, mimeType: file.type, fileSize: file.size,
  });
  if (result.success) return null;
  if (file.size > 5 * 1024 * 1024) return 'Choose a photo no larger than 5 MB.';
  if (!supportedTypes.some(type => type === file.type)) return 'Choose a JPEG, PNG or WebP photo.';
  if (file.size <= 0) return 'Choose a non-empty photo file.';
  return result.error.issues[0]?.message || 'Choose a valid profile photo.';
}

export async function uploadProfilePhoto(api: ApiClient, file: File, providerFetch: typeof fetch = fetch,
  onStage?: (stage: 'authorizing' | 'uploading' | 'finalizing') => void): Promise<MemberProfileResponse> {
  const validationError = validateProfilePhoto(file);
  if (validationError) throw new ProfilePhotoUploadError(validationError);
  onStage?.('authorizing');
  const target = await api.authorizeProfilePhotoUpload({
    originalFileName: file.name, mimeType: file.type, fileSize: file.size,
  });
  onStage?.('uploading');
  let uploaded: Response;
  try { uploaded = await providerFetch(target.uploadUrl, { method: target.method, headers: target.headers, body: file }); }
  catch { throw new ProfilePhotoUploadError('The private photo upload could not be completed. Please try again.'); }
  if (!uploaded.ok) throw new ProfilePhotoUploadError('The private photo upload could not be completed. Please try again.');
  onStage?.('finalizing');
  return api.finalizeProfilePhotoUpload(target.uploadToken);
}
