// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemberPayment } from '@/components/payment/member-payment';
import { ApiClient, ApiError, type CurrentPayment } from '@/lib/api-client';
import { PAYMENT_RECEIPT_MAX_BYTES, uploadPaymentReceipt, validatePaymentReceipt } from '@/lib/payment-receipt-upload';

const fixture = vi.hoisted(() => ({
  getCurrentPayment: vi.fn(), authorizePaymentReceiptUpload: vi.fn(), finalizePaymentReceiptAndSubmit: vi.fn(),
}));

vi.mock('@/lib/member-api', () => ({ createMemberApiClient: () => ({
  getCurrentPayment: fixture.getCurrentPayment,
  authorizePaymentReceiptUpload: fixture.authorizePaymentReceiptUpload,
  finalizePaymentReceiptAndSubmit: fixture.finalizePaymentReceiptAndSubmit,
}) }));

function current(status: string | null = 'NOT_SUBMITTED', applicationStatus = 'APPROVED_PENDING_PAYMENT'): CurrentPayment {
  return {
    applicationNumber: 'MYAIS-APP-2026-000042', applicationStatus,
    approvedMembershipType: { code: 'ASSOCIATE', name: 'Associate Member' },
    payment: {
      id: 'payment-private-id', paymentReference: 'PAY-000042', entranceFee: '50.00', membershipFee: '100.00',
      totalAmount: '150.00', currency: 'MYR', paymentMethod: null, bankName: null, transactionReference: null,
      paidAt: null, status, submittedAt: null, treasurerRemarks: null, rejectionReason: null,
    },
  };
}

beforeEach(() => {
  fixture.getCurrentPayment.mockReset().mockResolvedValue(current());
  fixture.authorizePaymentReceiptUpload.mockReset().mockResolvedValue({
    uploadToken: 'opaque-payment-token', uploadUrl: 'https://storage.example/private-signed-target',
    method: 'PUT', headers: { 'content-type': 'application/pdf' }, expiresAt: 'soon',
  });
  fixture.finalizePaymentReceiptAndSubmit.mockReset().mockResolvedValue({
    id: 'payment-private-id', paymentReference: 'PAY-000042', status: 'SUBMITTED',
    submittedAt: '2026-09-29T03:00:00.000Z', supersededReceiptCleanupPending: false,
  });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('member payment page', () => {
  it('renders authoritative fees and all source-backed payment methods', async () => {
    render(<MemberPayment />);
    expect(await screen.findByText('RM 150.00')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Bank transfer' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Online banking' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Cash deposit' })).toBeTruthy();
    expect(document.body.textContent).not.toContain('payment-private-id');
  });

  it('requires method, transaction reference and receipt with accessible inline errors', async () => {
    render(<MemberPayment />);
    await screen.findByText('PAY-000042');
    await userEvent.click(screen.getByRole('button', { name: 'Submit payment' }));
    expect(screen.getByText('Choose a payment method.')).toBeTruthy();
    expect(screen.getByText('Enter the transaction reference.')).toBeTruthy();
    expect(screen.getByText('Choose a payment receipt.')).toBeTruthy();
    expect(fixture.authorizePaymentReceiptUpload).not.toHaveBeenCalled();
  });

  it('uploads privately and finalizes using only server-supported payment fields', async () => {
    const user = userEvent.setup(); render(<MemberPayment />);
    await user.selectOptions(await screen.findByLabelText(/Payment method/), 'ONLINE_BANKING');
    await user.type(screen.getByLabelText(/Transaction reference/), '  TXN-9087  ');
    await user.type(screen.getByLabelText(/Bank/), '  Maybank  ');
    fireEvent.change(screen.getByLabelText(/Payment date/), { target: { value: '2026-09-28' } });
    await user.upload(screen.getByLabelText('Choose receipt'), new File(['pdf'], 'receipt.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: 'Submit payment' }));
    expect(await screen.findByText('Thank you. Your receipt was submitted securely.')).toBeTruthy();
    expect(fixture.finalizePaymentReceiptAndSubmit).toHaveBeenCalledWith({
      uploadToken: 'opaque-payment-token', paymentMethod: 'ONLINE_BANKING', transactionReference: 'TXN-9087',
      bankName: 'Maybank', paidAt: '2026-09-28',
    });
    expect(JSON.stringify(fixture.finalizePaymentReceiptAndSubmit.mock.calls[0]?.[0]))
      .not.toMatch(/userId|amount|status|paymentId|objectKey|uploadUrl/);
  });

  it.each([
    ['SUBMITTED', 'Payment submitted'], ['UNDER_VERIFICATION', 'Payment under verification'], ['VERIFIED', 'Payment verified'],
  ])('renders %s as read-only', async (status, heading) => {
    fixture.getCurrentPayment.mockResolvedValue(current(status, status === 'VERIFIED' ? 'ACTIVE' : 'PAYMENT_SUBMITTED'));
    render(<MemberPayment />);
    expect(await screen.findByRole('heading', { name: heading })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Submit payment/ })).toBeNull();
  });

  it('shows reviewer feedback and permits rejected payment resubmission', async () => {
    const rejected = current('REJECTED');
    rejected.payment!.rejectionReason = 'The receipt image is unreadable.';
    fixture.getCurrentPayment.mockResolvedValue(rejected);
    render(<MemberPayment />);
    expect(await screen.findByText('The receipt image is unreadable.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resubmit payment' })).toBeTruthy();
  });

  it('preserves entered values after a safe stale-state conflict', async () => {
    fixture.finalizePaymentReceiptAndSubmit.mockRejectedValue(new ApiError(409, 'request', 'private backend detail'));
    const user = userEvent.setup(); render(<MemberPayment />);
    await user.selectOptions(await screen.findByLabelText(/Payment method/), 'BANK_TRANSFER');
    const reference = screen.getByLabelText(/Transaction reference/);
    await user.type(reference, 'KEEP-ME');
    await user.upload(screen.getByLabelText('Choose receipt'), new File(['png'], 'receipt.png', { type: 'image/png' }));
    await user.click(screen.getByRole('button', { name: 'Submit payment' }));
    expect(await screen.findByText(/can no longer be submitted/)).toBeTruthy();
    expect((reference as HTMLInputElement).value).toBe('KEEP-ME');
    expect(document.body.textContent).not.toContain('private backend detail');
  });

  it('prevents duplicate submission while receipt authorization is in progress', async () => {
    let release: ((value: { uploadToken: string; uploadUrl: string; method: 'PUT'; headers: Record<string, string>; expiresAt: string }) => void) | undefined;
    fixture.authorizePaymentReceiptUpload.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const user = userEvent.setup(); render(<MemberPayment />);
    await user.selectOptions(await screen.findByLabelText(/Payment method/), 'CASH_DEPOSIT');
    await user.type(screen.getByLabelText(/Transaction reference/), 'TX-ONCE');
    await user.upload(screen.getByLabelText('Choose receipt'), new File(['pdf'], 'receipt.pdf', { type: 'application/pdf' }));
    const submit = screen.getByRole('button', { name: 'Submit payment' });
    await user.click(submit);
    expect(fixture.authorizePaymentReceiptUpload).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('button', { name: /Securing receipt/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Securing receipt/ }));
    expect(fixture.authorizePaymentReceiptUpload).toHaveBeenCalledTimes(1);
    release?.({ uploadToken: 'opaque-payment-token', uploadUrl: 'https://storage.example/upload', method: 'PUT',
      headers: {}, expiresAt: 'soon' });
    expect(await screen.findByText('Thank you. Your receipt was submitted securely.')).toBeTruthy();
  });

  it('shows an honest state when no current payment exists', async () => {
    fixture.getCurrentPayment.mockResolvedValue(null);
    render(<MemberPayment />);
    expect(await screen.findByText('No payment is currently due')).toBeTruthy();
  });
});

describe('private payment receipt flow', () => {
  it('accepts PDF/JPEG/PNG and rejects unsupported or oversized files', () => {
    expect(validatePaymentReceipt(new File(['pdf'], 'receipt.pdf', { type: 'application/pdf' }))).toBeNull();
    expect(validatePaymentReceipt(new File(['jpg'], 'receipt.jpg', { type: 'image/jpeg' }))).toBeNull();
    expect(validatePaymentReceipt(new File(['png'], 'receipt.png', { type: 'image/png' }))).toBeNull();
    expect(validatePaymentReceipt(new File(['txt'], 'receipt.txt', { type: 'text/plain' }))).toMatch(/PDF, JPEG or PNG/);
    expect(validatePaymentReceipt(new File([new Uint8Array(PAYMENT_RECEIPT_MAX_BYTES + 1)], 'large.pdf',
      { type: 'application/pdf' }))).toMatch(/5 MiB/);
  });

  it('returns only an opaque token after authorization and provider upload', async () => {
    const api = { authorizePaymentReceiptUpload: fixture.authorizePaymentReceiptUpload } as unknown as ApiClient;
    const provider = vi.fn(async () => new Response(null, { status: 200 }));
    const token = await uploadPaymentReceipt(api, new File(['pdf'], 'receipt.pdf', { type: 'application/pdf' }),
      provider as typeof fetch);
    expect(token).toBe('opaque-payment-token');
    expect(fixture.authorizePaymentReceiptUpload).toHaveBeenCalledWith({
      originalFileName: 'receipt.pdf', mimeType: 'application/pdf', fileSize: 3,
    });
    expect(provider).toHaveBeenCalledWith('https://storage.example/private-signed-target',
      expect.objectContaining({ method: 'PUT' }));
  });

  it('does not expose provider failure details', async () => {
    const api = { authorizePaymentReceiptUpload: fixture.authorizePaymentReceiptUpload } as unknown as ApiClient;
    await expect(uploadPaymentReceipt(api, new File(['png'], 'receipt.png', { type: 'image/png' }),
      vi.fn(async () => { throw new Error('provider credential detail'); }) as typeof fetch))
      .rejects.toThrow('The receipt could not be uploaded. Please try again.');
  });

  it('uses exact payment endpoints without client ownership or state fields', async () => {
    const requestBodies: string[] = [];
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requestBodies.push(String(init?.body));
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/receipt-upload/finalize')) return new Response(JSON.stringify({ status: 'SUBMITTED' }), { status: 200 });
      return new Response(JSON.stringify({ uploadToken: 'opaque' }), { status: 200 });
    });
    const api = new ApiClient('https://api.example.test', async () => 'jwt', fetcher as typeof fetch);
    await api.authorizePaymentReceiptUpload({ originalFileName: 'receipt.pdf', mimeType: 'application/pdf', fileSize: 10 });
    await api.finalizePaymentReceiptAndSubmit({ uploadToken: 'opaque', paymentMethod: 'CASH_DEPOSIT', transactionReference: 'TX-1' });
    expect(fetcher.mock.calls.map(call => new URL(String(call[0])).pathname)).toEqual([
      '/payments/current/receipt-upload', '/payments/current/receipt-upload/finalize',
    ]);
    for (const body of requestBodies) expect(body).not.toMatch(/userId|status|amount|paymentId/);
  });
});
