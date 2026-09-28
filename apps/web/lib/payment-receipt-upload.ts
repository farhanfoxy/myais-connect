import type { ApiClient } from './api-client';

export const PAYMENT_RECEIPT_ACCEPT = 'application/pdf,image/jpeg,image/png';
export const PAYMENT_RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

const allowedReceiptTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);

export function validatePaymentReceipt(file: File): string | null {
  if (!allowedReceiptTypes.has(file.type)) return 'Choose a PDF, JPEG or PNG receipt.';
  if (file.size <= 0) return 'The receipt file is empty.';
  if (file.size > PAYMENT_RECEIPT_MAX_BYTES) return 'The receipt must be 5 MiB or smaller.';
  return null;
}

export async function uploadPaymentReceipt(
  api: ApiClient,
  file: File,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const validationError = validatePaymentReceipt(file);
  if (validationError) throw new Error(validationError);

  const target = await api.authorizePaymentReceiptUpload({
    originalFileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
  });
  let response: Response;
  try {
    response = await fetcher(target.uploadUrl, {
      method: target.method,
      headers: target.headers,
      body: file,
    });
  } catch {
    throw new Error('The receipt could not be uploaded. Please try again.');
  }
  if (!response.ok) throw new Error('The receipt could not be uploaded. Please try again.');
  return target.uploadToken;
}
