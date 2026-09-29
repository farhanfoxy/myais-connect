// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApplicationTracker } from '@/components/application/application-tracker';
import { InformationResponse } from '@/components/application/information-response';
import { ApiClient, ApiError, type MembershipApplicationSummary } from '@/lib/api-client';
import {
  InformationAttachmentError, uploadInformationAttachment, validateInformationAttachment,
} from '@/lib/information-response-upload';

const fixture = vi.hoisted(() => ({
  listApplications: vi.fn(), authorizeInformationResponseUpload: vi.fn(), respondToInformationRequest: vi.fn(),
  getCurrentMembership: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: fixture.replace }) }));
vi.mock('@/lib/member-api', () => ({ createMemberApiClient: () => ({
  listApplications: fixture.listApplications,
  authorizeInformationResponseUpload: fixture.authorizeInformationResponseUpload,
  respondToInformationRequest: fixture.respondToInformationRequest,
  getCurrentMembership: fixture.getCurrentMembership,
}) }));

function application(status: string, overrides: Partial<MembershipApplicationSummary> = {}): MembershipApplicationSummary {
  return {
    id: '11111111-1111-4111-8111-111111111111', applicationNumber: 'MYAIS-APP-2026-000042',
    requestedMembershipType: { code: 'ASSOCIATE', name: 'Associate Member' },
    recommendedMembershipType: { code: 'ASSOCIATE', name: 'Associate Member' }, status, currentStep: 4,
    eligibilityScore: 60, eligibilityExplanation: 'Associate membership recommended.', latestReviewerRemarks: null,
    rejectionReason: null, submittedAt: '2026-09-20T00:00:00.000Z', createdAt: '2026-09-19T00:00:00.000Z',
    updatedAt: '2026-09-22T00:00:00.000Z', documents: [], reviewHistory: [], openInformationRequests: [],
    ...overrides,
  };
}

const openRequest = {
  id: '22222222-2222-4222-8222-222222222222', requestedByName: 'Committee Reviewer',
  message: 'Please clarify your professional experience.', dueDate: '2026-10-08', status: 'OPEN',
  createdAt: '2026-10-01T00:00:00.000Z',
};

beforeEach(() => {
  fixture.listApplications.mockReset().mockResolvedValue([]);
  fixture.authorizeInformationResponseUpload.mockReset();
  fixture.respondToInformationRequest.mockReset().mockResolvedValue({
    id: openRequest.id, status: 'RESPONDED', respondedAt: '2026-10-02T00:00:00.000Z',
    applicationStatus: 'UNDER_REVIEW', attachmentUploaded: false,
  });
  fixture.getCurrentMembership.mockReset().mockResolvedValue(null);
  fixture.replace.mockReset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('application tracker', () => {
  it('shows an honest no-application state', async () => {
    render(<ApplicationTracker />);
    expect(await screen.findByText('No application yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Start application' }).getAttribute('href')).toBe('/my-application');
  });

  it.each([
    ['DRAFT', 'Draft'], ['SUBMITTED', 'Submitted'], ['UNDER_REVIEW', 'Under review'],
    ['ADDITIONAL_INFORMATION_REQUIRED', 'Information'], ['RECOMMENDED_FOR_APPROVAL', 'Recommended'],
    ['APPROVED_PENDING_PAYMENT', 'Approved'], ['PAYMENT_SUBMITTED', 'Payment'],
    ['PAYMENT_UNDER_VERIFICATION', 'Payment'], ['ACTIVE', 'Active'],
  ])('maps %s to the source-backed %s stage', async (status, stage) => {
    fixture.listApplications.mockResolvedValue([application(status)]);
    render(<ApplicationTracker />);
    await screen.findByText('MYAIS-APP-2026-000042');
    const current = document.querySelector('[aria-current="step"]');
    expect(current).not.toBeNull();
    expect(current?.textContent).toContain(stage);
  });

  it('links an ACTIVE application to the card only when an ACTIVE membership is confirmed', async () => {
    fixture.listApplications.mockResolvedValue([application('ACTIVE')]);
    fixture.getCurrentMembership.mockResolvedValue({ membershipNumber: 'MYAIS-2026-000123',
      membershipTypeCode: 'ASSOCIATE', membershipTypeName: 'Associate Member', status: 'ACTIVE', startDate: '2026-01-01',
      expiryDate: '2026-12-31', votingEligible: false, activatedAt: '2026-01-01T00:00:00.000Z' });
    render(<ApplicationTracker />);
    expect((await screen.findByRole('link', { name: /View membership card/ })).getAttribute('href')).toBe('/my-card');
  });

  it('keeps rejected outside the progress stages and renders its reason', async () => {
    fixture.listApplications.mockResolvedValue([application('REJECTED', { rejectionReason: 'Required evidence was not supplied.' })]);
    render(<ApplicationTracker />);
    expect(await screen.findByText('Required evidence was not supplied.')).toBeTruthy();
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });

  it.each(['ELIGIBLE', 'EXPIRED', 'SUSPENDED', 'TERMINATED'])('does not invent timeline progress for %s', async status => {
    fixture.listApplications.mockResolvedValue([application(status)]);
    render(<ApplicationTracker />);
    expect(await screen.findByText('Timeline position unavailable for this legacy status')).toBeTruthy();
    expect(screen.getAllByText(status === 'ELIGIBLE' ? 'Eligible' : status[0] + status.slice(1).toLowerCase()).length)
      .toBeGreaterThan(0);
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });

  it('uses the first backend-ordered history item and renders review history newest-first', async () => {
    fixture.listApplications.mockResolvedValue([application('UNDER_REVIEW', { reviewHistory: [
      { id: 'new', decision: 'START_REVIEW', remarks: 'New review note', reviewerName: 'Reviewer Two', createdAt: '2026-10-02T00:00:00.000Z' },
      { id: 'old', decision: 'SUBMIT', remarks: 'Older review note', reviewerName: null, createdAt: '2026-10-01T00:00:00.000Z' },
    ] }), application('REJECTED', { applicationNumber: 'OLDER-APPLICATION' })]);
    render(<ApplicationTracker />);
    await screen.findByText('New review note');
    const history = screen.getByRole('heading', { name: 'Review history' }).closest('section');
    const items = within(history as HTMLElement).getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('New review note');
    expect(items[1]?.textContent).toContain('Older review note');
    expect(document.body.textContent).not.toContain('OLDER-APPLICATION');
  });

  it('shows the response action only for an open request in the required state', async () => {
    fixture.listApplications.mockResolvedValue([application('ADDITIONAL_INFORMATION_REQUIRED', {
      openInformationRequests: [openRequest], latestReviewerRemarks: 'Please respond by the due date.',
    })]);
    render(<ApplicationTracker />);
    expect((await screen.findAllByText(openRequest.message)).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Respond to request/ }).getAttribute('href')).toBe('/my-application/respond');
  });

  it.each([
    ['APPROVED_PENDING_PAYMENT', 'Submit payment'], ['PAYMENT_SUBMITTED', 'View payment'],
    ['PAYMENT_UNDER_VERIFICATION', 'View payment'], ['ACTIVE', 'View payment details'],
  ])('links the %s action to the payment page', async (status, label) => {
    fixture.listApplications.mockResolvedValue([application(status)]);
    render(<ApplicationTracker />);
    expect((await screen.findByRole('link', { name: new RegExp(label) })).getAttribute('href'))
      .toBe('/my-application/payment');
  });
});

describe('information response', () => {
  it('is unavailable outside the additional-information state', async () => {
    fixture.listApplications.mockResolvedValue([application('UNDER_REVIEW', { openInformationRequests: [openRequest] })]);
    render(<InformationResponse />);
    expect(await screen.findByText('No response required')).toBeTruthy();
    expect(screen.queryByLabelText(/Your response/)).toBeNull();
  });

  it('requires nonblank response text and submits without an optional attachment', async () => {
    fixture.listApplications.mockResolvedValue([application('ADDITIONAL_INFORMATION_REQUIRED', {
      openInformationRequests: [openRequest],
    })]);
    const user = userEvent.setup(); render(<InformationResponse />);
    const textarea = await screen.findByLabelText(/Your response/);
    const submit = screen.getByRole('button', { name: 'Submit response' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    await user.type(textarea, '  Here is the requested clarification.  ');
    await user.click(submit);
    await waitFor(() => expect(fixture.respondToInformationRequest).toHaveBeenCalledWith(
      application('ADDITIONAL_INFORMATION_REQUIRED').id, openRequest.id,
      { response: 'Here is the requested clarification.' },
    ));
    expect(fixture.replace).toHaveBeenCalledWith('/my-application/tracker');
  });

  it('displays multiple open requests but submits only the selected request', async () => {
    const second = { ...openRequest, id: '33333333-3333-4333-8333-333333333333', message: 'Please provide a second detail.' };
    fixture.listApplications.mockResolvedValue([application('ADDITIONAL_INFORMATION_REQUIRED', {
      openInformationRequests: [openRequest, second],
    })]);
    const user = userEvent.setup(); render(<InformationResponse />);
    expect((await screen.findAllByText(openRequest.message)).length).toBeGreaterThan(0);
    expect(screen.getByText(second.message)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Request 2/ }));
    await user.type(screen.getByLabelText(/Your response/), 'Second request response');
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    await waitFor(() => expect(fixture.respondToInformationRequest).toHaveBeenCalledWith(
      application('ADDITIONAL_INFORMATION_REQUIRED').id, second.id, { response: 'Second request response' },
    ));
    expect(fixture.respondToInformationRequest).toHaveBeenCalledTimes(1);
  });

  it('rejects unsafe attachment metadata before requesting upload authorization', async () => {
    fixture.listApplications.mockResolvedValue([application('ADDITIONAL_INFORMATION_REQUIRED', {
      openInformationRequests: [openRequest],
    })]);
    render(<InformationResponse />);
    const input = await screen.findByLabelText('Choose attachment');
    fireEvent.change(input, { target: { files: [new File(['unsafe'], 'notes.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText('Choose a PDF, JPEG, JPG or PNG file.')).toBeTruthy();
    expect(fixture.authorizeInformationResponseUpload).not.toHaveBeenCalled();
  });

  it('authorizes, uploads, and submits an optional attachment using only its opaque token', async () => {
    fixture.listApplications.mockResolvedValue([application('ADDITIONAL_INFORMATION_REQUIRED', {
      openInformationRequests: [openRequest],
    })]);
    fixture.authorizeInformationResponseUpload.mockResolvedValue({ uploadToken: 'opaque-response-token',
      uploadUrl: 'https://provider.example/signed-private-target', method: 'PUT',
      headers: { 'content-type': 'application/pdf' }, expiresAt: 'soon' });
    const provider = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', provider);
    const user = userEvent.setup(); render(<InformationResponse />);
    await user.upload(await screen.findByLabelText('Choose attachment'),
      new File(['pdf'], 'support.pdf', { type: 'application/pdf' }));
    await user.type(screen.getByLabelText(/Your response/), 'Attached is the requested evidence.');
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    await waitFor(() => expect(fixture.respondToInformationRequest).toHaveBeenCalledWith(
      application('ADDITIONAL_INFORMATION_REQUIRED').id, openRequest.id,
      { response: 'Attached is the requested evidence.', attachmentUploadToken: 'opaque-response-token' },
    ));
    expect(provider).toHaveBeenCalledWith('https://provider.example/signed-private-target', expect.objectContaining({ method: 'PUT' }));
    expect(document.body.textContent).not.toContain('signed-private-target');
  });

  it('shows a safe stale-request conflict and preserves response text', async () => {
    fixture.listApplications.mockResolvedValue([application('ADDITIONAL_INFORMATION_REQUIRED', {
      openInformationRequests: [openRequest],
    })]);
    fixture.respondToInformationRequest.mockRejectedValue(new ApiError(409, 'request', 'hidden backend detail'));
    const user = userEvent.setup(); render(<InformationResponse />);
    const textarea = await screen.findByLabelText(/Your response/);
    await user.type(textarea, 'Keep this response');
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    expect(await screen.findByText(/no longer available for a response/)).toBeTruthy();
    expect((textarea as HTMLTextAreaElement).value).toBe('Keep this response');
    expect(document.body.textContent).not.toContain('hidden backend detail');
  });
});

describe('private information attachment flow', () => {
  it('rejects files over 5 MiB and unsupported MIME types', () => {
    expect(() => validateInformationAttachment(new File(['x'], 'notes.txt', { type: 'text/plain' })))
      .toThrow('Choose a PDF, JPEG, JPG or PNG file.');
    const large = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' });
    expect(() => validateInformationAttachment(large)).toThrow('Choose a file no larger than 5 MB.');
  });

  it('authorizes and uploads privately, returning only the opaque token', async () => {
    const api = { authorizeInformationResponseUpload: vi.fn(async () => ({ uploadToken: 'opaque-token',
      uploadUrl: 'https://provider.example/private-signed-target', method: 'PUT' as const,
      headers: { 'content-type': 'application/pdf' }, expiresAt: 'soon' })) } as unknown as ApiClient;
    const provider = vi.fn(async () => new Response(null, { status: 200 }));
    const stages: string[] = [];
    const token = await uploadInformationAttachment(api, application('UNDER_REVIEW').id, openRequest.id,
      new File(['pdf'], 'clarification.pdf', { type: 'application/pdf' }), provider as typeof fetch,
      stage => stages.push(stage));
    expect(token).toBe('opaque-token');
    expect(api.authorizeInformationResponseUpload).toHaveBeenCalledWith(application('UNDER_REVIEW').id, openRequest.id,
      { originalFileName: 'clarification.pdf', mimeType: 'application/pdf', fileSize: 3 });
    expect(provider).toHaveBeenCalledWith('https://provider.example/private-signed-target', expect.objectContaining({ method: 'PUT' }));
    expect(stages).toEqual(['authorizing', 'uploading']);
  });

  it('sanitizes provider failures', async () => {
    const api = { authorizeInformationResponseUpload: vi.fn(async () => ({ uploadToken: 'opaque',
      uploadUrl: 'https://provider.internal/secret', method: 'PUT' as const, headers: {}, expiresAt: 'soon' })) } as unknown as ApiClient;
    await expect(uploadInformationAttachment(api, application('UNDER_REVIEW').id, openRequest.id,
      new File(['image'], 'evidence.jpg', { type: 'image/jpeg' }),
      vi.fn(async () => { throw new Error('provider credentials'); }) as typeof fetch))
      .rejects.toEqual(new InformationAttachmentError('The private upload could not be completed. Please try again.'));
  });

  it('uses the exact NestJS request paths and never sends ownership or status fields', async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(JSON.stringify(body)).not.toMatch(/userId|applicationStatus|requestStatus|objectKey/);
      return new Response(JSON.stringify({ uploadToken: 'opaque', uploadUrl: 'https://upload.test', method: 'PUT',
        headers: {}, expiresAt: 'soon' }), { status: 200 });
    });
    const api = new ApiClient('https://api.example.test', async () => 'jwt', fetcher as typeof fetch);
    await api.authorizeInformationResponseUpload(application('UNDER_REVIEW').id, openRequest.id,
      { originalFileName: 'file.pdf', mimeType: 'application/pdf', fileSize: 10 });
    expect(new URL(String(fetcher.mock.calls[0]?.[0])).pathname).toBe(
      `/applications/${application('UNDER_REVIEW').id}/information-requests/${openRequest.id}/attachment-upload`);
  });
});
