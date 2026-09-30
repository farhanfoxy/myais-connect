// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApplicationQueue } from '@/components/admin/application-queue';
import { ApplicationReviewDetail } from '@/components/admin/application-review-detail';
import { ApiClient, ApiError, type ReviewerApplicationDetail, type ReviewerApplicationQueue } from '@/lib/api-client';
import { canFinallyApprove, canReviewApplications } from '@/lib/roles';

const fixture = vi.hoisted(() => ({
  role: 'PRESIDENT' as string | null,
  listReviewerApplications: vi.fn(),
  getReviewerApplication: vi.fn(),
  getReviewerDocumentDownload: vi.fn(),
  startApplicationReview: vi.fn(),
  requestApplicationInformation: vi.fn(),
  recommendApplicationApproval: vi.fn(),
  approveApplication: vi.fn(),
  rejectApplication: vi.fn(),
  listReviewerMembershipTypes: vi.fn(),
}));

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({ state: { status: 'authenticated', user: {
    id: 'reviewer-id', email: 'reviewer@example.test', fullName: 'Review Person', photoUrl: null,
    role: fixture.role, accountStatus: 'ACTIVE',
  } } }),
}));

vi.mock('@/lib/admin-api', () => ({
  createAdminApiClient: () => fixture,
}));

const queue: ReviewerApplicationQueue = {
  items: [{
    id: 'application-id', applicationNumber: 'MYAIS-APP-2026-000001', applicantName: 'Aisyah Rahman',
    applicantEmail: 'aisyah@example.test', requestedMembershipType: { code: 'ORDINARY', name: 'Ordinary Member' },
    recommendedMembershipType: { code: 'ORDINARY', name: 'Ordinary Member' }, status: 'SUBMITTED',
    submittedAt: '2026-09-20T08:00:00.000Z', createdAt: '2026-09-19T08:00:00.000Z',
  }],
  page: 1, pageSize: 15, total: 1, totalPages: 1,
};

function detail(status = 'SUBMITTED'): ReviewerApplicationDetail {
  return {
    id: 'application-id', applicationNumber: 'MYAIS-APP-2026-000001', status,
    applicant: { displayName: 'Aisyah Rahman', email: 'aisyah@example.test', nationality: 'Malaysian',
      dateOfBirth: '1990-01-02', institution: 'Universiti Contoh', aisMember: true,
      aisMembershipNumber: 'AIS-100', aisMembershipExpiry: '2027-12-31' },
    requestedMembershipType: { code: 'ORDINARY', name: 'Ordinary Member' },
    recommendedMembershipType: { code: 'ORDINARY', name: 'Ordinary Member' }, eligibilityScore: 100,
    eligibilityExplanation: 'All eligibility conditions passed.', latestReviewerRemarks: 'Ready for review',
    rejectionReason: null, submittedAt: '2026-09-20T08:00:00.000Z', reviewedAt: null, approvedAt: null,
    rejectedAt: null, createdAt: '2026-09-19T08:00:00.000Z', updatedAt: '2026-09-20T08:00:00.000Z',
    documents: [{ id: 'document-id', documentType: 'IDENTIFICATION', originalFileName: 'identity.pdf',
      mimeType: 'application/pdf', fileSize: 1024, verificationStatus: 'PENDING', reviewerRemarks: null,
      verifiedAt: null, createdAt: '2026-09-20T08:00:00.000Z', downloadAvailable: true }],
    reviewHistory: [{ id: 'review-id', reviewerName: 'Committee Reviewer', decision: 'START_REVIEW', remarks: 'Review started',
      previousStatus: 'SUBMITTED', newStatus: 'UNDER_REVIEW', createdAt: '2026-09-21T08:00:00.000Z' }],
  };
}

beforeEach(() => {
  fixture.role = 'PRESIDENT';
  fixture.listReviewerApplications.mockReset().mockResolvedValue(queue);
  fixture.getReviewerApplication.mockReset().mockResolvedValue(detail());
  fixture.getReviewerDocumentDownload.mockReset().mockResolvedValue({ downloadUrl: 'https://signed.example.test/one',
    expiresAt: '2026-09-30T01:00:00.000Z' });
  fixture.startApplicationReview.mockReset().mockResolvedValue({ status: 'UNDER_REVIEW' });
  fixture.requestApplicationInformation.mockReset().mockResolvedValue({ status: 'ADDITIONAL_INFORMATION_REQUIRED' });
  fixture.recommendApplicationApproval.mockReset().mockResolvedValue({ status: 'RECOMMENDED_FOR_APPROVAL' });
  fixture.approveApplication.mockReset().mockResolvedValue({ status: 'APPROVED_PENDING_PAYMENT' });
  fixture.rejectApplication.mockReset().mockResolvedValue({ status: 'REJECTED' });
  fixture.listReviewerMembershipTypes.mockReset().mockResolvedValue([
    { id: 'honorary-id', code: 'HONORARY', name: 'Honorary Member' },
    { id: 'ordinary-id', code: 'ORDINARY', name: 'Ordinary Member' },
  ]);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('reviewer role policy', () => {
  it.each(['PRESIDENT', 'DEPUTY_PRESIDENT', 'SECRETARY', 'ASSISTANT_SECRETARY', 'COMMITTEE_MEMBER', 'SYSTEM_ADMINISTRATOR'])
  ('allows %s into application review', role => expect(canReviewApplications(role)).toBe(true));

  it.each(['TREASURER', 'APPLICANT', 'ORDINARY_MEMBER', 'ASSOCIATE_MEMBER'])
  ('denies %s application review controls', role => expect(canReviewApplications(role)).toBe(false));

  it('reserves final approval for President and System Administrator', () => {
    expect(canFinallyApprove('PRESIDENT')).toBe(true);
    expect(canFinallyApprove('SYSTEM_ADMINISTRATOR')).toBe(true);
    expect(canFinallyApprove('SECRETARY')).toBe(false);
  });
});

describe('application queue', () => {
  it('renders loading, safe rows and server pagination', async () => {
    let resolveQueue!: (value: ReviewerApplicationQueue) => void;
    fixture.listReviewerApplications.mockReturnValueOnce(new Promise(resolve => { resolveQueue = resolve; }));
    const user = userEvent.setup();
    render(<ApplicationQueue />);
    expect(screen.getByText('Loading applications…')).toBeTruthy();
    resolveQueue({ ...queue, total: 16, totalPages: 2 });
    expect(await screen.findAllByText('Aisyah Rahman')).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/storageObjectKey|legacyBase44Id|userId/);
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(() => expect(fixture.listReviewerApplications).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 })));
  });

  it('sends search and status filters to the API and resets them', async () => {
    const user = userEvent.setup();
    render(<ApplicationQueue />);
    await screen.findAllByText('Aisyah Rahman');
    await user.type(screen.getByPlaceholderText(/Search applicant/), '  Aisyah  ');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(fixture.listReviewerApplications).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'Aisyah', page: 1 })));
    await user.selectOptions(screen.getByLabelText('Status'), 'UNDER_REVIEW');
    await waitFor(() => expect(fixture.listReviewerApplications).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'UNDER_REVIEW' })));
    await user.click(screen.getByRole('button', { name: /Reset/ }));
    await waitFor(() => expect(fixture.listReviewerApplications).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: '', status: 'ALL' })));
  });

  it('renders a truthful empty state', async () => {
    fixture.listReviewerApplications.mockResolvedValue({ ...queue, items: [], total: 0, totalPages: 0 });
    render(<ApplicationQueue />);
    expect(await screen.findByText('No applications found')).toBeTruthy();
  });
});

describe('application detail and actions', () => {
  it('renders applicant, application, documents and review history without private internals', async () => {
    render(<ApplicationReviewDetail applicationId="application-id" />);
    expect(await screen.findByText('Applicant profile')).toBeTruthy();
    expect(screen.getAllByText('Aisyah Rahman').length).toBeGreaterThan(0);
    expect(screen.getByText('All eligibility conditions passed.')).toBeTruthy();
    expect(screen.getByText('identity.pdf')).toBeTruthy();
    expect(document.body.textContent).toContain('Committee Reviewer');
    expect(document.body.textContent).not.toMatch(/storageObjectKey|legacyBase44Id|reviewerUserId|userId/);
  });

  it('starts review with confirmation and refreshes from the server', async () => {
    const user = userEvent.setup();
    render(<ApplicationReviewDetail applicationId="application-id" />);
    await user.click(await screen.findByRole('button', { name: 'Start review' }));
    const dialog = screen.getByRole('dialog', { name: 'Start application review' });
    await user.click(within(dialog).getByRole('button', { name: 'Start review' }));
    await waitFor(() => expect(fixture.startApplicationReview).toHaveBeenCalledWith('application-id', ''));
    expect(fixture.getReviewerApplication.mock.calls.length).toBeGreaterThan(1);
  });

  it('validates and submits an information request with the supported due date', async () => {
    fixture.getReviewerApplication.mockResolvedValue(detail('UNDER_REVIEW'));
    const user = userEvent.setup(); render(<ApplicationReviewDetail applicationId="application-id" />);
    await user.click(await screen.findByRole('button', { name: 'Request information' }));
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(screen.getByText('Remarks are required.')).toBeTruthy();
    await user.type(screen.getByPlaceholderText('Add concise reviewer context'), 'Please provide clearer evidence.');
    await user.type(screen.getByLabelText(/Due date/), '2026-10-20');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(fixture.requestApplicationInformation).toHaveBeenCalledWith('application-id',
      { remarks: 'Please provide clearer evidence.', dueDate: '2026-10-20' }));
  });

  it('recommends approval and validates rejection remarks', async () => {
    fixture.getReviewerApplication.mockResolvedValue(detail('UNDER_REVIEW'));
    const user = userEvent.setup(); render(<ApplicationReviewDetail applicationId="application-id" />);
    await user.click(await screen.findByRole('button', { name: 'Recommend approval' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Recommend for approval' }))
      .getByRole('button', { name: 'Recommend approval' }));
    await waitFor(() => expect(fixture.recommendApplicationApproval).toHaveBeenCalledWith('application-id', ''));
    cleanup(); fixture.getReviewerApplication.mockResolvedValue(detail('UNDER_REVIEW'));
    render(<ApplicationReviewDetail applicationId="application-id" />);
    await user.click(await screen.findByRole('button', { name: 'Reject application' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Reject application' }))
      .getByRole('button', { name: 'Reject application' }));
    expect(screen.getByText('Remarks are required.')).toBeTruthy();
  });

  it('handles stale state and self-review denial safely', async () => {
    fixture.getReviewerApplication.mockResolvedValue(detail('SUBMITTED'));
    fixture.startApplicationReview.mockRejectedValueOnce(new ApiError(409, 'request', 'private'));
    const user = userEvent.setup(); render(<ApplicationReviewDetail applicationId="application-id" />);
    await user.click(await screen.findByRole('button', { name: 'Start review' }));
    let dialog = screen.getByRole('dialog', { name: 'Start application review' });
    await user.click(within(dialog).getByRole('button', { name: 'Start review' }));
    expect(await screen.findByText(/changed on the server/)).toBeTruthy();
    fixture.startApplicationReview.mockRejectedValueOnce(new ApiError(403, 'forbidden', 'private'));
    dialog = screen.getByRole('dialog', { name: 'Start application review' });
    await user.click(within(dialog).getByRole('button', { name: 'Start review' }));
    expect(await screen.findByText(/Self-review and role restrictions/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('private');
  });

  it.each(['PRESIDENT', 'SYSTEM_ADMINISTRATOR'])('%s can approve using reviewer membership types including HONORARY', async role => {
    fixture.role = role; fixture.getReviewerApplication.mockResolvedValue(detail('RECOMMENDED_FOR_APPROVAL'));
    const user = userEvent.setup(); render(<ApplicationReviewDetail applicationId="application-id" />);
    await user.click(await screen.findByRole('button', { name: 'Approve application' }));
    expect(fixture.listReviewerMembershipTypes).toHaveBeenCalledOnce();
    expect(await screen.findByRole('option', { name: 'Honorary Member (HONORARY)' })).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Approved membership type'), 'honorary-id');
    await user.click(within(screen.getByRole('dialog', { name: 'Approve application' }))
      .getByRole('button', { name: 'Approve application' }));
    await waitFor(() => expect(fixture.approveApplication).toHaveBeenCalledWith('application-id',
      { approvedMembershipTypeId: 'honorary-id', remarks: '' }));
  });

  it('does not expose final approval to other reviewer roles', async () => {
    fixture.role = 'SECRETARY'; fixture.getReviewerApplication.mockResolvedValue(detail('RECOMMENDED_FOR_APPROVAL'));
    render(<ApplicationReviewDetail applicationId="application-id" />);
    await screen.findByText('Final approval is restricted to the President and System Administrator.');
    expect(screen.queryByRole('button', { name: 'Approve application' })).toBeNull();
  });

  it('opens a temporary private target and renders legacy files as unavailable', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const value = detail(); value.documents.push({ ...value.documents[0]!, id: 'legacy-document', originalFileName: 'legacy.pdf',
      downloadAvailable: false });
    fixture.getReviewerApplication.mockResolvedValue(value);
    const user = userEvent.setup(); render(<ApplicationReviewDetail applicationId="application-id" />);
    await user.click(await screen.findByRole('button', { name: 'Open securely' }));
    await waitFor(() => expect(open).toHaveBeenCalledWith('https://signed.example.test/one', '_blank', 'noopener,noreferrer'));
    expect(screen.getByText('Legacy file unavailable')).toBeTruthy();
    expect(document.body.textContent).not.toContain('https://signed.example.test/one');
  });
});

describe('review API routes', () => {
  it('uses reviewer routes for approval choices and never the applicant membership endpoint', async () => {
    const fetcher = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
      async () => new Response('[]', { status: 200 }));
    const api = new ApiClient('https://api.example.test', async () => 'token', fetcher as typeof fetch);
    await api.listReviewerMembershipTypes();
    expect(fetcher.mock.calls[0]?.[0]).toContain('/reviewer/membership-types');
    expect(fetcher.mock.calls[0]?.[0]).not.toContain('/registration/membership-types');
  });

  it('sends approvedMembershipTypeId to the existing approval endpoint', async () => {
    const fetcher = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
      async () => new Response('{}', { status: 200 }));
    const api = new ApiClient('https://api.example.test', async () => 'token', fetcher as typeof fetch);
    await api.approveApplication('application-id', { approvedMembershipTypeId: 'type-id', remarks: 'Approved' });
    expect(fetcher.mock.calls[0]?.[0]).toContain('/reviewer/applications/application-id/approve');
    expect(JSON.parse(String((fetcher.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      approvedMembershipTypeId: 'type-id', remarks: 'Approved',
    });
  });
});
