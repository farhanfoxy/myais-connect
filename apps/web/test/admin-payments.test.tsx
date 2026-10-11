// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentQueue, formatMoney } from '@/components/admin/payment-queue';
import { PaymentReviewDetail } from '@/components/admin/payment-review-detail';
import AdminOverviewPage from '@/app/(protected)/admin/page';
import { ApiClient, ApiError, type AdminDashboardResponse, type ReviewerPaymentDetail,
  type ReviewerPaymentQueue } from '@/lib/api-client';
import { canReviewPayments } from '@/lib/roles';

const fixture = vi.hoisted(() => ({
  role: 'TREASURER' as string | null,
  getAdminDashboard: vi.fn(),
  listReviewerPayments: vi.fn(), getReviewerPayment: vi.fn(), getReviewerPaymentReceiptDownload: vi.fn(),
  verifyReviewerPayment: vi.fn(), rejectReviewerPayment: vi.fn(),
}));

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({ state: { status: 'authenticated', user: {
    id: 'treasurer-id', email: 'treasurer@example.test', fullName: 'Treasurer Person', photoUrl: null,
    role: fixture.role, accountStatus: 'ACTIVE',
  } } }),
}));

vi.mock('@/lib/admin-api', () => ({ createAdminApiClient: () => fixture }));
vi.mock('recharts', async () => {
  const React = await import('react');
  const Element = ({ children }: { children?: React.ReactNode }) => React.createElement('div', {}, children);
  return {
    ResponsiveContainer: Element, BarChart: Element, LineChart: Element, PieChart: Element, Pie: Element,
    Bar: Element, Line: Element, CartesianGrid: Element, Tooltip: Element, XAxis: Element, YAxis: Element,
    Cell: () => null,
  };
});

const queue: ReviewerPaymentQueue = {
  items: [{ id: 'payment-id', paymentReference: 'MYAIS-PAY-2026-000001', applicantName: 'Aisyah Rahman',
    applicantEmail: 'aisyah@example.test', applicationNumber: 'MYAIS-APP-2026-000001',
    membershipType: { code: 'ORDINARY', name: 'Ordinary Member' }, totalAmount: '150', currency: 'MYR',
    paymentMethod: 'BANK_TRANSFER', submittedAt: '2026-09-20T08:00:00.000Z', status: 'SUBMITTED',
    createdAt: '2026-09-19T08:00:00.000Z' }],
  page: 1, pageSize: 15, total: 1, totalPages: 1,
};

function dashboard(role = 'TREASURER'): AdminDashboardResponse {
  return {
    viewer: { displayName: 'Treasurer Person', role },
    permissions: { reviewApplications: role === 'SYSTEM_ADMINISTRATOR', finalApproval: role === 'SYSTEM_ADMINISTRATOR',
      verifyPayments: true, manageEvents: role === 'SYSTEM_ADMINISTRATOR' },
    kpis: { activeMembers: 12, upcomingEvents: 1, paymentsToVerify: 2,
      ...(role === 'SYSTEM_ADMINISTRATOR' ? { applicationsNeedingReview: 3, finalApprovals: 1 } : {}) },
    charts: { paymentStatus: [{ status: 'SUBMITTED', value: 2 }] }, attention: [], upcomingEvents: [],
    recentActivity: [], operationalInsights: { membershipsExpiringSoon: 0, windowDays: 30 },
  };
}

function detail(status = 'SUBMITTED'): ReviewerPaymentDetail {
  return {
    id: 'payment-id', paymentReference: 'MYAIS-PAY-2026-000001', status,
    applicant: { displayName: 'Aisyah Rahman', email: 'aisyah@example.test' },
    application: { applicationNumber: 'MYAIS-APP-2026-000001', status: status === 'VERIFIED' ? 'ACTIVE' :
      status === 'REJECTED' ? 'APPROVED_PENDING_PAYMENT' : 'PAYMENT_SUBMITTED',
      approvedMembershipType: { code: 'ORDINARY', name: 'Ordinary Member' } },
    entranceFee: '100', membershipFee: '50', totalAmount: '150', currency: 'MYR',
    paymentMethod: 'BANK_TRANSFER', bankName: 'Example Bank', transactionReference: 'TX-100',
    paidAt: '2026-09-20T07:30:00.000Z', submittedAt: '2026-09-20T08:00:00.000Z',
    rejectionReason: status === 'REJECTED' ? 'Receipt unclear' : null,
    treasurerRemarks: status === 'REJECTED' ? 'Receipt unclear' : status === 'VERIFIED' ? 'Verified manually' : null,
    verifiedAt: status === 'VERIFIED' ? '2026-09-21T08:00:00.000Z' : null,
    receiptDownloadAvailable: true,
  };
}

beforeEach(() => {
  fixture.role = 'TREASURER';
  fixture.getAdminDashboard.mockReset().mockResolvedValue(dashboard());
  fixture.listReviewerPayments.mockReset().mockResolvedValue(queue);
  fixture.getReviewerPayment.mockReset().mockResolvedValue(detail());
  fixture.getReviewerPaymentReceiptDownload.mockReset().mockResolvedValue({
    downloadUrl: 'https://signed.example.test/receipt', expiresAt: '2026-09-30T01:00:00.000Z',
  });
  fixture.verifyReviewerPayment.mockReset().mockResolvedValue({ status: 'VERIFIED', applicationStatus: 'ACTIVE',
    membershipNumber: 'MYAIS-2026-000001' });
  fixture.rejectReviewerPayment.mockReset().mockResolvedValue({ status: 'REJECTED',
    applicationStatus: 'APPROVED_PENDING_PAYMENT' });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('payment role policy', () => {
  it.each(['TREASURER', 'SYSTEM_ADMINISTRATOR'])('allows %s payment verification', role => {
    expect(canReviewPayments(role)).toBe(true);
  });

  it.each(['PRESIDENT', 'DEPUTY_PRESIDENT', 'SECRETARY', 'ASSISTANT_SECRETARY', 'COMMITTEE_MEMBER',
    'APPLICANT', 'ORDINARY_MEMBER'])('denies %s payment verification', role => {
    expect(canReviewPayments(role)).toBe(false);
  });
});

describe('admin overview integration', () => {
  it('links Treasurer directly to the real payment queue', async () => {
    fixture.role = 'TREASURER';
    render(<AdminOverviewPage />);
    expect((await screen.findByRole('link', { name: /Verify payments/ })).getAttribute('href')).toBe('/admin/payments');
    expect(screen.queryByRole('link', { name: /Application review/ })).toBeNull();
  });

  it('shows both real work areas to System Administrator without fake metrics', async () => {
    fixture.role = 'SYSTEM_ADMINISTRATOR';
    fixture.getAdminDashboard.mockResolvedValue(dashboard('SYSTEM_ADMINISTRATOR'));
    render(<AdminOverviewPage />);
    expect((await screen.findByRole('link', { name: /Application queue/ })).getAttribute('href')).toBe('/admin/applications');
    expect(screen.getByRole('link', { name: /Verify payments/ }).getAttribute('href')).toBe('/admin/payments');
    expect(document.body.textContent).not.toMatch(/revenue|conversion|growth/i);
  });
});

describe('payment queue', () => {
  it('loads safe backend data, formats authoritative money and paginates on the server', async () => {
    let resolveQueue!: (value: ReviewerPaymentQueue) => void;
    fixture.listReviewerPayments.mockReturnValueOnce(new Promise(resolve => { resolveQueue = resolve; }));
    const user = userEvent.setup(); render(<PaymentQueue />);
    expect(screen.getByText('Loading payments…')).toBeTruthy();
    resolveQueue({ ...queue, total: 16, totalPages: 2 });
    expect((await screen.findAllByText('Aisyah Rahman')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('RM 150.00').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/receiptObjectKey|receiptUrl|userId|applicationId|verifiedByUserId/);
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(() => expect(fixture.listReviewerPayments).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });

  it('uses backend search/status filters and resets them', async () => {
    const user = userEvent.setup(); render(<PaymentQueue />);
    await screen.findAllByText('Aisyah Rahman');
    await user.type(screen.getByPlaceholderText(/Search applicant/), '  PAY-1  ');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(fixture.listReviewerPayments).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'PAY-1', page: 1 })));
    await user.selectOptions(screen.getByLabelText('Status'), 'UNDER_VERIFICATION');
    await waitFor(() => expect(fixture.listReviewerPayments).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'UNDER_VERIFICATION' })));
    await user.click(screen.getByRole('button', { name: /Reset/ }));
    await waitFor(() => expect(fixture.listReviewerPayments).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: '', status: 'ALL' })));
  });

  it('renders a truthful empty state and safely handles other currencies', async () => {
    fixture.listReviewerPayments.mockResolvedValue({ ...queue, items: [], total: 0, totalPages: 0 });
    render(<PaymentQueue />);
    expect(await screen.findByText('No payments found')).toBeTruthy();
    expect(formatMoney('20', 'USD')).toMatch(/20\.00/);
  });
});

describe('payment detail and receipt', () => {
  it('renders applicant, application, fee, payment and verification fields without internals', async () => {
    render(<PaymentReviewDetail paymentId="payment-id" />);
    expect(await screen.findByText('Applicant and application')).toBeTruthy();
    expect(screen.getByText('Example Bank')).toBeTruthy();
    expect(screen.getByText('TX-100')).toBeTruthy();
    expect(screen.getAllByText('RM 100.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('RM 50.00').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/receiptObjectKey|receiptUrl|userId|applicationId|verifiedByUserId/);
  });

  it('opens only a temporary authorized receipt target and handles legacy unavailability', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup(); render(<PaymentReviewDetail paymentId="payment-id" />);
    await user.click(await screen.findByRole('button', { name: 'View receipt' }));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://signed.example.test/receipt', '_blank', 'noopener,noreferrer'));
    expect(document.body.textContent).not.toContain('https://signed.example.test/receipt');
    cleanup(); fixture.getReviewerPayment.mockResolvedValue({ ...detail(), receiptDownloadAvailable: false });
    render(<PaymentReviewDetail paymentId="payment-id" />);
    expect(await screen.findByText('This legacy payment has no native private receipt object.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'View receipt' })).toBeNull();
  });
});

describe('payment decisions', () => {
  it.each(['TREASURER', 'SYSTEM_ADMINISTRATOR'])('%s verifies an actionable payment and refreshes', async role => {
    fixture.role = role;
    const user = userEvent.setup(); render(<PaymentReviewDetail paymentId="payment-id" />);
    await user.click(await screen.findByRole('button', { name: 'Verify payment' }));
    const dialog = screen.getByRole('dialog', { name: 'Verify payment' });
    await user.type(within(dialog).getByPlaceholderText('Add concise verification context'), 'Funds confirmed');
    await user.click(within(dialog).getByRole('button', { name: 'Verify payment' }));
    await waitFor(() => expect(fixture.verifyReviewerPayment).toHaveBeenCalledWith('payment-id', 'Funds confirmed'));
    expect(await screen.findByText(/Membership MYAIS-2026-000001 is now active/)).toBeTruthy();
    expect(fixture.getReviewerPayment.mock.calls.length).toBeGreaterThan(1);
  });

  it('supports the backend-approved UNDER_VERIFICATION source state', async () => {
    fixture.getReviewerPayment.mockResolvedValue(detail('UNDER_VERIFICATION'));
    render(<PaymentReviewDetail paymentId="payment-id" />);
    expect(await screen.findByRole('button', { name: 'Verify payment' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reject payment' })).toBeTruthy();
  });

  it('prevents duplicate verification while pending and handles stale/self-verification failures safely', async () => {
    let rejectVerify!: (error: Error) => void;
    fixture.verifyReviewerPayment.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectVerify = reject; }));
    const user = userEvent.setup(); render(<PaymentReviewDetail paymentId="payment-id" />);
    await user.click(await screen.findByRole('button', { name: 'Verify payment' }));
    let dialog = screen.getByRole('dialog', { name: 'Verify payment' });
    const submit = within(dialog).getByRole('button', { name: 'Verify payment' });
    await user.click(submit);
    expect((within(dialog).getByRole('button', { name: 'Working…' }) as HTMLButtonElement).disabled).toBe(true);
    rejectVerify(new ApiError(409, 'request', 'private'));
    expect(await screen.findByText(/changed on the server/)).toBeTruthy();
    fixture.verifyReviewerPayment.mockRejectedValueOnce(new ApiError(403, 'forbidden', 'private'));
    dialog = screen.getByRole('dialog', { name: 'Verify payment' });
    await user.click(within(dialog).getByRole('button', { name: 'Verify payment' }));
    expect(await screen.findByText(/Self-verification and role restrictions/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('private');
  });

  it('requires a rejection reason, submits it, and refreshes', async () => {
    const user = userEvent.setup(); render(<PaymentReviewDetail paymentId="payment-id" />);
    await user.click(await screen.findByRole('button', { name: 'Reject payment' }));
    const dialog = screen.getByRole('dialog', { name: 'Reject payment' });
    await user.click(within(dialog).getByRole('button', { name: 'Reject payment' }));
    expect(screen.getByText('Rejection reason is required.')).toBeTruthy();
    await user.type(within(dialog).getByPlaceholderText(/Explain why/), 'Receipt is unreadable');
    await user.click(within(dialog).getByRole('button', { name: 'Reject payment' }));
    await waitFor(() => expect(fixture.rejectReviewerPayment).toHaveBeenCalledWith('payment-id', 'Receipt is unreadable'));
    expect(await screen.findByText(/can resubmit payment evidence without creating another application/)).toBeTruthy();
  });

  it.each(['VERIFIED', 'REJECTED', 'NOT_SUBMITTED'])('keeps %s payments read-only', async status => {
    fixture.getReviewerPayment.mockResolvedValue(detail(status));
    render(<PaymentReviewDetail paymentId="payment-id" />);
    expect(await screen.findByText('Read-only state')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Verify payment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject payment' })).toBeNull();
  });

  it('does not show mutation controls to unauthorized canonical roles', async () => {
    fixture.role = 'PRESIDENT';
    render(<PaymentReviewDetail paymentId="payment-id" />);
    expect(await screen.findByText('Your canonical role does not authorize payment verification.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Verify payment' })).toBeNull();
  });
});

describe('payment reviewer API routes', () => {
  it('uses reviewer queue, receipt, verify and reject endpoints with exact bodies', async () => {
    const fetcher = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
      async () => new Response('{}', { status: 200 }));
    const api = new ApiClient('https://api.example.test', async () => 'token', fetcher as typeof fetch);
    await api.getReviewerPaymentReceiptDownload('payment-id');
    await api.verifyReviewerPayment('payment-id', 'Verified');
    await api.rejectReviewerPayment('payment-id', 'Rejected');
    expect(fetcher.mock.calls[0]?.[0]).toContain('/reviewer/payments/payment-id/receipt/download');
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({ treasurerRemarks: 'Verified' });
    expect(JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body))).toEqual({ remarks: 'Rejected' });
  });
});
