// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApplicationWizard, eligibilityPayload } from '@/components/application/application-wizard';
import { ApiClient, type ApplicationDocument, type MemberProfileResponse,
  type MembershipApplicationSummary } from '@/lib/api-client';
import { ApplicationUploadError, uploadApplicationDocument, validateApplicationFile } from '@/lib/application-upload';

const fixture = vi.hoisted(() => ({
  getProfile: vi.fn(), listMembershipTypes: vi.fn(), getCurrentApplication: vi.fn(), listApplications: vi.fn(),
  listApplicationDocuments: vi.fn(), evaluateEligibility: vi.fn(), createApplicationDraft: vi.fn(),
  authorizeApplicationDocumentUpload: vi.fn(), finalizeApplicationDocumentUpload: vi.fn(),
  deleteApplicationDocument: vi.fn(), getApplicationDocumentDownload: vi.fn(), submitApplication: vi.fn(),
  state: { status: 'authenticated' as const, user: { id: 'user-1', email: 'member@example.test',
    fullName: 'Aisyah Rahman', photoUrl: null, role: 'APPLICANT', accountStatus: 'ACTIVE' } },
}));

vi.mock('@/components/auth/auth-provider', () => ({ useAuth: () => ({ state: fixture.state }) }));
vi.mock('@/lib/member-api', () => ({ createMemberApiClient: () => ({
  getProfile: fixture.getProfile, listMembershipTypes: fixture.listMembershipTypes,
  getCurrentApplication: fixture.getCurrentApplication, listApplications: fixture.listApplications,
  listApplicationDocuments: fixture.listApplicationDocuments, evaluateEligibility: fixture.evaluateEligibility,
  createApplicationDraft: fixture.createApplicationDraft,
  authorizeApplicationDocumentUpload: fixture.authorizeApplicationDocumentUpload,
  finalizeApplicationDocumentUpload: fixture.finalizeApplicationDocumentUpload,
  deleteApplicationDocument: fixture.deleteApplicationDocument,
  getApplicationDocumentDownload: fixture.getApplicationDocumentDownload, submitApplication: fixture.submitApplication,
}) }));

const completeProfile: MemberProfileResponse = { email: 'member@example.test', photoUrl: null, exists: true, profile: {
  fullName: 'Aisyah Rahman', phoneNumber: '+60123456789', identificationType: 'NRIC', identificationNumber: 'id-1',
  nationality: 'Malaysian', dateOfBirth: '1990-01-01', gender: 'FEMALE', addressLine1: '1 Jalan Ilmu',
  addressLine2: null, city: 'Kuala Lumpur', state: 'Kuala Lumpur', postcode: '50000', country: 'Malaysia',
  institution: 'Universiti Contoh', occupation: 'Lecturer', department: 'Information Systems',
  areaOfExpertise: 'Digital transformation', aisMember: false, aisMembershipNumber: null,
  aisMembershipExpiry: null, profileCompletionPercentage: 100,
} };

const eligibility = { recommendedTypeCode: 'ASSOCIATE' as const, recommendedTypeName: 'Associate Member',
  explanation: 'Associate membership recommended.', score: 60, selectableTypeCodes: ['ASSOCIATE' as const] };

const membershipTypes = [
  { id: 'type-ordinary', code: 'ORDINARY' as const, name: 'Ordinary Member', description: 'Ordinary membership',
    entranceFee: '20', membershipFee: '100' },
  { id: 'type-associate', code: 'ASSOCIATE' as const, name: 'Associate Member', description: 'Associate membership',
    entranceFee: '20', membershipFee: '80' },
];

const documents: ApplicationDocument[] = [
  { id: 'doc-id', documentType: 'IDENTIFICATION', originalFileName: 'identity.pdf', mimeType: 'application/pdf',
    fileSize: 1200, verificationStatus: 'PENDING', createdAt: '2026-09-20T00:00:00.000Z', downloadAvailable: true },
  { id: 'doc-ais', documentType: 'AIS_MEMBERSHIP_PROOF', originalFileName: 'ais.pdf', mimeType: 'application/pdf',
    fileSize: 1300, verificationStatus: 'PENDING', createdAt: '2026-09-20T00:00:00.000Z', downloadAvailable: true },
  { id: 'doc-photo', documentType: 'PROFILE_PHOTO', originalFileName: 'photo.jpg', mimeType: 'image/jpeg',
    fileSize: 1400, verificationStatus: 'PENDING', createdAt: '2026-09-20T00:00:00.000Z', downloadAvailable: true },
];

function application(status = 'DRAFT'): MembershipApplicationSummary {
  return { id: '11111111-1111-4111-8111-111111111111', applicationNumber: status === 'DRAFT' ? null : 'MYAIS-APP-2026-000042',
    requestedMembershipType: { code: 'ASSOCIATE', name: 'Associate Member' },
    recommendedMembershipType: { code: 'ASSOCIATE', name: 'Associate Member' }, eligibilityScore: 60,
    eligibilityExplanation: 'Associate membership recommended.', latestReviewerRemarks: null, rejectionReason: null,
    status, currentStep: status === 'DRAFT' ? 3 : 4, submittedAt: status === 'DRAFT' ? null : '2026-09-25T00:00:00.000Z',
    createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-25T00:00:00.000Z', documents,
    reviewHistory: [], openInformationRequests: [] };
}

beforeEach(() => {
  fixture.state.user.role = 'APPLICANT';
  fixture.getProfile.mockReset().mockResolvedValue(completeProfile);
  fixture.listMembershipTypes.mockReset().mockResolvedValue(membershipTypes);
  fixture.getCurrentApplication.mockReset().mockResolvedValue(null);
  fixture.listApplications.mockReset().mockResolvedValue([]);
  fixture.listApplicationDocuments.mockReset().mockResolvedValue(documents);
  fixture.evaluateEligibility.mockReset().mockResolvedValue(eligibility);
  fixture.createApplicationDraft.mockReset().mockResolvedValue(application());
  fixture.authorizeApplicationDocumentUpload.mockReset(); fixture.finalizeApplicationDocumentUpload.mockReset();
  fixture.deleteApplicationDocument.mockReset().mockResolvedValue({ deleted: true });
  fixture.getApplicationDocumentDownload.mockReset().mockResolvedValue({ downloadUrl: 'https://storage.example/private?token=temporary', expiresAt: 'soon' });
  fixture.submitApplication.mockReset().mockResolvedValue(application('SUBMITTED'));
  vi.stubGlobal('confirm', vi.fn(() => true));
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('application initialization and eligibility', () => {
  it('starts at eligibility when no current or historical application exists', async () => {
    render(<ApplicationWizard />);
    expect(await screen.findByText('Check your eligibility')).toBeTruthy();
    expect(fixture.createApplicationDraft).not.toHaveBeenCalled();
  });

  it('resumes an existing draft directly at its private document step', async () => {
    fixture.getCurrentApplication.mockResolvedValue(application());
    render(<ApplicationWizard />);
    expect(await screen.findByText('Upload supporting documents')).toBeTruthy();
    expect(fixture.listApplicationDocuments).toHaveBeenCalledWith(application().id);
    expect(screen.queryByText('Check your eligibility')).toBeNull();
  });

  it('renders an active non-draft application read-only', async () => {
    fixture.getCurrentApplication.mockResolvedValue(application('UNDER_REVIEW'));
    render(<ApplicationWizard />);
    expect((await screen.findAllByText('Under review')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Choose file')).toBeNull();
    expect(screen.queryByText('Submit application')).toBeNull();
  });

  it('uses history when current returns null without creating a draft', async () => {
    fixture.listApplications.mockResolvedValue([application('REJECTED')]);
    render(<ApplicationWizard />);
    expect(await screen.findByText('Most recent application')).toBeTruthy();
    expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0);
    expect(fixture.createApplicationDraft).not.toHaveBeenCalled();
  });

  it('shows an ACTIVE associate application from history as completed and read-only', async () => {
    fixture.state.user.role = 'ASSOCIATE_MEMBER';
    fixture.listApplications.mockResolvedValue([application('ACTIVE')]);
    render(<ApplicationWizard />);
    expect((await screen.findAllByText('Active')).length).toBeGreaterThan(0);
    expect(screen.getByText('MYAIS-APP-2026-000042')).toBeTruthy();
    expect(screen.queryByText('Check your eligibility')).toBeNull();
    expect(screen.queryByText('Upload supporting documents')).toBeNull();
    expect(screen.queryByText(/could not load your membership details/i)).toBeNull();
    expect(fixture.createApplicationDraft).not.toHaveBeenCalled();
  });

  it('submits only source-backed eligibility input and shows the server result', async () => {
    const user = userEvent.setup(); render(<ApplicationWizard />);
    await user.click(await screen.findByRole('button', { name: /Check eligibility/ }));
    expect(fixture.evaluateEligibility).toHaveBeenCalledWith({
      malaysianCitizen: true, dateOfBirth: '1990-01-01', residingInMalaysia: true, aisMember: false,
    });
    expect(await screen.findByText('Associate membership recommended.')).toBeTruthy();
    expect(screen.getByText('60')).toBeTruthy();
  });

  it('filters backend membership types by selectable codes and creates the exact draft request', async () => {
    const user = userEvent.setup(); render(<ApplicationWizard />);
    await user.click(await screen.findByRole('button', { name: /Check eligibility/ }));
    expect(screen.queryByRole('radio', { name: /Ordinary Member/ })).toBeNull();
    const associate = await screen.findByRole('radio', { name: /Associate Member/ });
    await user.click(associate); expect(associate.getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('button', { name: /Continue to documents/ }));
    expect(fixture.createApplicationDraft).toHaveBeenCalledWith({ requestedMembershipTypeCode: 'ASSOCIATE',
      eligibility: { malaysianCitizen: true, dateOfBirth: '1990-01-01', residingInMalaysia: true, aisMember: false } });
    expect(await screen.findByText('Upload supporting documents')).toBeTruthy();
  });

  it('builds eligibility payloads without empty optional values', () => {
    expect(eligibilityPayload({ malaysianCitizen: false, dateOfBirth: '', residingInMalaysia: false,
      aisMember: true, aisNumber: ' AIS-1 ', aisExpiry: '' })).toEqual({ malaysianCitizen: false,
      residingInMalaysia: false, aisMember: true, aisNumber: 'AIS-1' });
  });

  it('shows incomplete-profile guidance without blocking eligibility', async () => {
    fixture.getProfile.mockResolvedValue({ ...completeProfile, profile: { ...completeProfile.profile,
      profileCompletionPercentage: 67 } });
    render(<ApplicationWizard />);
    expect(await screen.findByText('Complete your profile before submitting')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Complete profile/ }).getAttribute('href')).toBe('/profile');
    expect(screen.getByRole('button', { name: /Check eligibility/ })).toBeTruthy();
  });
});

describe('private document operations', () => {
  it('rejects unsupported MIME types and files larger than 5 MB before authorization', () => {
    expect(() => validateApplicationFile('IDENTIFICATION', new File(['text'], 'notes.txt', { type: 'text/plain' })))
      .toThrow('Choose a PDF, JPEG, JPG or PNG file.');
    const tooLarge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' });
    expect(() => validateApplicationFile('IDENTIFICATION', tooLarge)).toThrow('Choose a file no larger than 5 MB.');
  });

  it('authorizes, uploads to the signed provider target, and finalizes with only the token', async () => {
    const api = { authorizeApplicationDocumentUpload: vi.fn(async () => ({ uploadToken: 'opaque-token',
      uploadUrl: 'https://storage.example/signed?token=temporary', method: 'PUT' as const,
      headers: { 'content-type': 'application/pdf', 'x-upsert': 'false' }, expiresAt: 'soon' })),
      finalizeApplicationDocumentUpload: vi.fn(async () => documents[0]) } as unknown as ApiClient;
    const provider = vi.fn(async () => new Response(null, { status: 200 }));
    const stages: string[] = [];
    await uploadApplicationDocument(api, application().id, 'IDENTIFICATION',
      new File(['pdf'], 'identity.pdf', { type: 'application/pdf' }), provider as typeof fetch, stage => stages.push(stage));
    expect(api.authorizeApplicationDocumentUpload).toHaveBeenCalledWith(application().id, {
      documentType: 'IDENTIFICATION', originalFileName: 'identity.pdf', mimeType: 'application/pdf', fileSize: 3,
    });
    expect(provider).toHaveBeenCalledWith('https://storage.example/signed?token=temporary', expect.objectContaining({ method: 'PUT' }));
    expect(api.finalizeApplicationDocumentUpload).toHaveBeenCalledWith(application().id, 'opaque-token');
    expect(stages).toEqual(['authorizing', 'uploading', 'finalizing']);
  });

  it('sanitizes provider failures', async () => {
    const api = { authorizeApplicationDocumentUpload: vi.fn(async () => ({ uploadToken: 'opaque',
      uploadUrl: 'https://provider.internal/secret', method: 'PUT' as const, headers: {}, expiresAt: 'soon' })) } as unknown as ApiClient;
    await expect(uploadApplicationDocument(api, application().id, 'PROFILE_PHOTO',
      new File(['image'], 'photo.png', { type: 'image/png' }), vi.fn(async () => { throw new Error('provider secret'); }) as typeof fetch))
      .rejects.toEqual(new ApplicationUploadError('The private upload could not be completed. Please try again.'));
  });

  it('renders safe metadata, supports duplicate document rows, and never renders private fields', async () => {
    fixture.getCurrentApplication.mockResolvedValue(application());
    fixture.listApplicationDocuments.mockResolvedValue([...documents, { ...documents[0], id: 'doc-id-2', originalFileName: 'identity-2.pdf',
      storageObjectKey: 'must-not-render', fileUrl: 'https://legacy.example/private' }]);
    render(<ApplicationWizard />);
    expect(await screen.findByText('identity-2.pdf')).toBeTruthy();
    expect(screen.getByText('2 uploaded')).toBeTruthy();
    expect(document.body.textContent).not.toContain('must-not-render');
    expect(document.body.textContent).not.toContain('legacy.example');
  });

  it('deletes only after confirmation and refreshes the server list', async () => {
    fixture.getCurrentApplication.mockResolvedValue(application());
    const user = userEvent.setup(); render(<ApplicationWizard />);
    await user.click(await screen.findByRole('button', { name: 'Delete identity.pdf' }));
    expect(confirm).toHaveBeenCalled();
    expect(fixture.deleteApplicationDocument).toHaveBeenCalledWith(application().id, 'doc-id');
    expect(fixture.listApplicationDocuments).toHaveBeenCalledTimes(2);
  });

  it('obtains a temporary download target without rendering or persisting it', async () => {
    fixture.getCurrentApplication.mockResolvedValue(application());
    const open = vi.fn(() => null); vi.stubGlobal('open', open);
    const user = userEvent.setup(); render(<ApplicationWizard />);
    await user.click(await screen.findByRole('button', { name: 'Download identity.pdf' }));
    expect(fixture.getApplicationDocumentDownload).toHaveBeenCalledWith(application().id, 'doc-id');
    expect(open).toHaveBeenCalledWith('https://storage.example/private?token=temporary', '_blank', 'noopener,noreferrer');
    expect(document.body.textContent).not.toContain('storage.example');
  });
});

describe('review and submission', () => {
  it('requires the declaration before enabling submission', async () => {
    fixture.getCurrentApplication.mockResolvedValue(application());
    const user = userEvent.setup(); render(<ApplicationWizard />);
    await user.click(await screen.findByRole('button', { name: /Review application/ }));
    const submit = screen.getByRole('button', { name: /Submit application/ }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: /information and documents provided are accurate/ }));
    expect(submit.disabled).toBe(false);
  });

  it('submits through the server and uses its application number and timestamp', async () => {
    fixture.getCurrentApplication.mockResolvedValue(application());
    const user = userEvent.setup(); render(<ApplicationWizard />);
    await user.click(await screen.findByRole('button', { name: /Review application/ }));
    await user.click(screen.getByRole('checkbox', { name: /information and documents provided are accurate/ }));
    await user.click(screen.getByRole('button', { name: /Submit application/ }));
    expect(fixture.submitApplication).toHaveBeenCalledWith(application().id);
    expect(await screen.findByText('MYAIS-APP-2026-000042')).toBeTruthy();
    expect(screen.getAllByText('Submitted').length).toBeGreaterThan(0);
  });

  it('keeps the draft editable and shows a safe error when submission fails', async () => {
    fixture.getCurrentApplication.mockResolvedValue(application());
    fixture.submitApplication.mockRejectedValue(new Error('database details'));
    const user = userEvent.setup(); render(<ApplicationWizard />);
    await user.click(await screen.findByRole('button', { name: /Review application/ }));
    await user.click(screen.getByRole('checkbox', { name: /information and documents provided are accurate/ }));
    await user.click(screen.getByRole('button', { name: /Submit application/ }));
    expect(await screen.findByText(/server could not submit this application/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('database details');
    expect(screen.getByRole('button', { name: /Back to documents/ })).toBeTruthy();
  });
});

describe('typed application API', () => {
  it('uses NestJS endpoints and never includes ownership or server-owned fields', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === '/applications/draft') {
        const body = JSON.parse(String(init?.body));
        expect(body).toEqual({ requestedMembershipTypeCode: 'ASSOCIATE', eligibility: { aisMember: false } });
        expect(JSON.stringify(body)).not.toMatch(/userId|status|score|applicationNumber/);
      }
      return new Response(JSON.stringify(path === '/registration/membership-types' ? membershipTypes : application()), { status: 200 });
    });
    const api = new ApiClient('https://api.example.test', async () => 'token', fetcher as typeof fetch);
    await api.listMembershipTypes();
    await api.createApplicationDraft({ requestedMembershipTypeCode: 'ASSOCIATE', eligibility: { aisMember: false } });
    expect(fetcher.mock.calls.map(call => new URL(String(call[0])).pathname)).toEqual([
      '/registration/membership-types', '/applications/draft',
    ]);
  });
});
