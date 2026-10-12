// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardPage from '@/app/(protected)/dashboard/page';
import ProfilePage from '@/app/(protected)/profile/page';
import type { CurrentPayment, MemberProfileResponse, MembershipApplicationSummary } from '@/lib/api-client';

const fixture = vi.hoisted(() => ({
  refresh: vi.fn(async () => ({ status: 'authenticated' })),
  getProfile: vi.fn(), updateProfile: vi.fn(), authorizeProfilePhotoUpload: vi.fn(), finalizeProfilePhotoUpload: vi.fn(),
  providerUpload: vi.fn(), getCurrentApplication: vi.fn(),
  listApplications: vi.fn(), getCurrentPayment: vi.fn(),
  getCurrentMembership: vi.fn(),
  listEvents: vi.fn(), listOwnEventRegistrations: vi.fn(),
  state: {
    status: 'authenticated' as const,
    user: { id: 'user-1', email: 'member@example.test', fullName: 'Aisyah Rahman', photoUrl: null,
      role: 'APPLICANT', accountStatus: 'ACTIVE' },
  },
}));

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({ state: fixture.state, refresh: fixture.refresh }),
}));

vi.mock('@/lib/member-api', () => ({
  createMemberApiClient: () => ({
    getProfile: fixture.getProfile, updateProfile: fixture.updateProfile,
    authorizeProfilePhotoUpload: fixture.authorizeProfilePhotoUpload,
    finalizeProfilePhotoUpload: fixture.finalizeProfilePhotoUpload,
    getCurrentApplication: fixture.getCurrentApplication, listApplications: fixture.listApplications,
    getCurrentPayment: fixture.getCurrentPayment,
    getCurrentMembership: fixture.getCurrentMembership,
    listEvents: fixture.listEvents,
    listOwnEventRegistrations: fixture.listOwnEventRegistrations,
  }),
}));

const emptyProfile: MemberProfileResponse = {
  email: 'member@example.test', photoUrl: null, exists: false,
  profile: {
    fullName: 'Aisyah Rahman', phoneNumber: null, identificationType: null, identificationNumber: null,
    nationality: null, dateOfBirth: null, gender: null, addressLine1: null, addressLine2: null,
    city: null, state: null, postcode: null, country: null, institution: null, occupation: null,
    department: null, areaOfExpertise: null, aisMember: false, aisMembershipNumber: null,
    aisMembershipExpiry: null, profileCompletionPercentage: 0,
  },
};

const populatedProfile: MemberProfileResponse = {
  email: 'member@example.test', photoUrl: null, exists: true,
  profile: {
    fullName: 'Aisyah Rahman', phoneNumber: '+60123456789', identificationType: 'NRIC',
    identificationNumber: 'identity-1', nationality: 'Malaysian', dateOfBirth: '1990-01-02', gender: 'FEMALE',
    addressLine1: '1 Jalan Ilmu', addressLine2: null, city: 'Kuala Lumpur', state: 'Kuala Lumpur',
    postcode: '50000', country: 'Malaysia', institution: 'Universiti Contoh', occupation: 'Lecturer',
    department: 'Information Systems', areaOfExpertise: 'Digital transformation', aisMember: false,
    aisMembershipNumber: null, aisMembershipExpiry: null, profileCompletionPercentage: 100,
  },
};

const draft: MembershipApplicationSummary = {
  id: 'application-1', applicationNumber: null, requestedMembershipType: { code: 'ASSOCIATE', name: 'Associate' },
  recommendedMembershipType: null, status: 'DRAFT', currentStep: 2, submittedAt: null,
  eligibilityScore: 80, eligibilityExplanation: 'Associate membership recommended.', latestReviewerRemarks: null,
  rejectionReason: null, documents: [], reviewHistory: [], createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-21T00:00:00.000Z', openInformationRequests: [],
};

const payable: CurrentPayment = {
  applicationNumber: 'MYAIS-APP-2026-000042', applicationStatus: 'APPROVED_PENDING_PAYMENT',
  approvedMembershipType: { code: 'ASSOCIATE', name: 'Associate Member' },
  payment: { id: 'payment-id', paymentReference: 'PAY-000042', entranceFee: '50.00', membershipFee: '100.00',
    totalAmount: '150.00', currency: 'MYR', paymentMethod: null, bankName: null, transactionReference: null,
    paidAt: null, status: 'NOT_SUBMITTED', submittedAt: null, treasurerRemarks: null, rejectionReason: null },
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete document.documentElement.dataset.theme; });
beforeEach(() => {
  fixture.state.user.role = 'APPLICANT';
  fixture.refresh.mockClear();
  fixture.getProfile.mockReset().mockResolvedValue(populatedProfile);
  fixture.updateProfile.mockReset().mockResolvedValue(populatedProfile);
  fixture.authorizeProfilePhotoUpload.mockReset().mockResolvedValue({ uploadToken: 'opaque-photo-token',
    uploadUrl: 'https://storage.example.test/signed-upload', method: 'PUT', headers: { 'content-type': 'image/jpeg' },
    expiresAt: '2026-10-01T01:00:00.000Z' });
  fixture.finalizeProfilePhotoUpload.mockReset().mockResolvedValue({ ...populatedProfile,
    photoUrl: 'https://storage.example.test/signed-read' });
  fixture.providerUpload.mockReset().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal('fetch', fixture.providerUpload);
  fixture.getCurrentApplication.mockReset().mockResolvedValue(null);
  fixture.listApplications.mockReset().mockResolvedValue([]);
  fixture.getCurrentPayment.mockReset().mockResolvedValue(null);
  fixture.getCurrentMembership.mockReset().mockResolvedValue(null);
  fixture.listEvents.mockReset().mockResolvedValue([]);
  fixture.listOwnEventRegistrations.mockReset().mockResolvedValue([]);
});

describe('real member dashboard', () => {
  it('renders the member dashboard inside the active dark theme', async () => {
    document.documentElement.dataset.theme = 'dark';
    render(<DashboardPage />);
    expect(await screen.findByText('Welcome back, Aisyah Rahman.')).toBeTruthy();
    expect(document.querySelector('.dashboard-page')).toBeTruthy();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
  it('showcases real events and links to the full Events workspace', async () => {
    fixture.listEvents.mockResolvedValue([{ id: 'event-1', title: 'MyAIS Digital Forum', category: 'CONFERENCES',
      summary: 'Professional community programme', description: 'Details', coverImage: null, speakerName: null,
      speakerTitle: null, eventType: null, venueType: 'ONLINE', venueName: null, physicalAddress: null,
      startDate: '2099-10-20', startTime: '09:00', endDate: null, endTime: null, registrationStart: null,
      registrationDeadline: null, capacity: null, limitedSeats: false, memberFee: '0', nonMemberFee: '0', currency: 'MYR',
      paymentInstructions: null, status: 'PUBLISHED', targetAudience: 'MEMBERS_AND_NON_MEMBERS', eventNumber: null,
      publishedAt: null, cancellationReason: null, placeholderImageNotice: false, timezone: 'Asia/Kuala_Lumpur',
      registrationAvailable: false }]);
    render(<DashboardPage />);
    expect(await screen.findByRole('heading', { name: 'MyAIS Digital Forum' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View more events' }).getAttribute('href')).toBe('/events');
  });

  it('renders canonical identity, profile completion and an honest no-application state', async () => {
    render(<DashboardPage />);
    expect(screen.getByText('Welcome back, Aisyah Rahman.')).toBeTruthy();
    expect(document.querySelector('.welcome-brand.official-myais-mark img')?.getAttribute('src'))
      .toContain('myais-official-logo.jpg');
    expect(await screen.findByText('100%')).toBeTruthy();
    expect(screen.getAllByText('No application record found').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Your progress' })).toBeTruthy();
    expect(screen.getByText(/Next:/).textContent).toContain('Start application');
    expect(screen.getByLabelText('1 of 5 stages complete')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Next:.*Start application/ }).getAttribute('href')).toBe('/my-application');
    expect(screen.getByRole('heading', { name: 'Featured events' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View more events' }).getAttribute('href')).toBe('/events');
    expect(screen.queryByRole('heading', { name: 'Quick actions' })).toBeNull();
  });

  it('renders a current application with readable status and the correct next action', async () => {
    fixture.getCurrentApplication.mockResolvedValue(draft);
    fixture.listApplications.mockResolvedValue([draft]);
    render(<DashboardPage />);
    expect(await screen.findByText('Draft application')).toBeTruthy();
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Next:.*Continue application/ }).getAttribute('href'))
      .toBe('/my-application');
  });

  it('uses application history when current intentionally returns null', async () => {
    const rejected = { ...draft, applicationNumber: 'MYAIS-APP-2026-000001', status: 'REJECTED' };
    fixture.listApplications.mockResolvedValue([rejected]);
    render(<DashboardPage />);
    expect((await screen.findAllByText('MYAIS-APP-2026-000001')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0);
    expect(screen.getByText('Recent application')).toBeTruthy();
  });

  it('renders an ACTIVE associate membership from history when optional payment data is unavailable', async () => {
    fixture.state.user.role = 'ASSOCIATE_MEMBER';
    const active = { ...draft, applicationNumber: 'MYAIS-APP-2026-000042', status: 'ACTIVE' };
    fixture.listApplications.mockResolvedValue([active]);
    fixture.getCurrentPayment.mockRejectedValue(new Error('optional payment unavailable'));
    fixture.getCurrentMembership.mockResolvedValue({ membershipNumber: 'MYAIS-2026-000042',
      membershipTypeCode: 'ASSOCIATE', membershipTypeName: 'Associate Member',
      status: 'ACTIVE', startDate: '2026-01-01', expiryDate: null, votingEligible: false,
      activatedAt: '2026-01-01T00:00:00.000Z' });
    render(<DashboardPage />);
    expect((await screen.findAllByText('MYAIS-APP-2026-000042')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getByText('Membership Active')).toBeTruthy();
    expect(screen.getByLabelText('5 of 5 stages complete')).toBeTruthy();
    expect(screen.getByText(/Next:/).textContent).toContain('View membership card');
    expect(screen.queryByText(/could not load your membership details/i)).toBeNull();
    expect(screen.queryByText('Check your eligibility')).toBeNull();
  });

  it('links the state-aware journey action when payment data is available', async () => {
    const approved = { ...draft, applicationNumber: payable.applicationNumber, status: 'APPROVED_PENDING_PAYMENT' };
    fixture.getCurrentApplication.mockResolvedValue(approved);
    fixture.listApplications.mockResolvedValue([approved]);
    fixture.getCurrentPayment.mockResolvedValue(payable);
    render(<DashboardPage />);
    expect((await screen.findByRole('link', { name: /Next:.*Make payment/ })).getAttribute('href'))
      .toBe('/my-application/payment');
  });

  it('sources membership number and card availability from the membership API', async () => {
    fixture.getCurrentMembership.mockResolvedValue({ membershipNumber: 'MYAIS-2026-000123',
      membershipTypeCode: 'ASSOCIATE', membershipTypeName: 'Associate Member', status: 'ACTIVE', startDate: '2026-01-01',
      expiryDate: null, votingEligible: false, activatedAt: '2026-01-01T00:00:00.000Z' });
    render(<DashboardPage />);
    expect((await screen.findAllByText('MYAIS-2026-000123')).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Download card' }).getAttribute('href')).toBe('/my-card');
    expect(screen.getByLabelText('5 of 5 stages complete')).toBeTruthy();
  });

  it('isolates membership API failure from required dashboard data', async () => {
    fixture.getCurrentMembership.mockRejectedValue(new Error('private membership error'));
    render(<DashboardPage />);
    expect(await screen.findByText(/Membership card temporarily unavailable/)).toBeTruthy();
    expect(screen.queryByText(/could not load your membership details/i)).toBeNull();
    expect(document.body.textContent).not.toContain('private membership error');
  });

  it('still shows the safe page-level error when required profile data fails', async () => {
    fixture.getProfile.mockRejectedValue(new Error('private database detail'));
    render(<DashboardPage />);
    expect(await screen.findByText(/could not load your membership details/i)).toBeTruthy();
    expect(document.body.textContent).not.toContain('private database detail');
  });
});

describe('member profile', () => {
  it('hydrates a populated profile, renders backend completion, and keeps email read-only', async () => {
    render(<ProfilePage />);
    expect(await screen.findByDisplayValue('Universiti Contoh')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByLabelText('Email').getAttribute('readonly')).not.toBeNull();
  });

  it('renders the empty profile state and validates required fields inline', async () => {
    fixture.getProfile.mockResolvedValue(emptyProfile);
    const user = userEvent.setup();
    render(<ProfilePage />);
    await screen.findByDisplayValue('Aisyah Rahman');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    expect((await screen.findAllByText('Required')).length).toBeGreaterThan(5);
    expect(fixture.updateProfile).not.toHaveBeenCalled();
  });

  it('requires AIS number and expiry only when AIS membership is selected', async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);
    await screen.findByDisplayValue('Universiti Contoh');
    await user.click(screen.getByRole('checkbox', { name: /I am an AIS member/ }));
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    expect((await screen.findAllByText('Required for AIS members')).length).toBe(2);
    expect(fixture.updateProfile).not.toHaveBeenCalled();
  });

  it('sends a successful PUT and refreshes the canonical user name', async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);
    const name = await screen.findByLabelText('Full name');
    await user.clear(name); await user.type(name, '  Nur   Aina  ');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(fixture.updateProfile).toHaveBeenCalledOnce());
    expect(fixture.updateProfile.mock.calls[0]?.[0]).toMatchObject({ fullName: 'Nur Aina' });
    expect(await screen.findByText('Profile saved successfully.')).toBeTruthy();
    expect(fixture.refresh).toHaveBeenCalledOnce();
  });

  it('preserves edited values when PUT fails and shows a safe error', async () => {
    fixture.updateProfile.mockRejectedValue(new Error('internal provider detail'));
    const user = userEvent.setup();
    render(<ProfilePage />);
    const occupation = await screen.findByLabelText('Occupation');
    await user.clear(occupation); await user.type(occupation, 'Researcher');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText('We could not save your profile. Your changes are still here.')).toBeTruthy();
    expect((screen.getByLabelText('Occupation') as HTMLInputElement).value).toBe('Researcher');
    expect(screen.queryByText('internal provider detail')).toBeNull();
  });

  it('uploads a validated photo privately, refreshes identity, and shows success', async () => {
    const user = userEvent.setup(); render(<ProfilePage />);
    await screen.findByDisplayValue('Universiti Contoh');
    const file = new File(['photo'], 'member.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/Upload photo/), file);
    await user.click(screen.getByRole('button', { name: 'Save photo' }));
    await waitFor(() => expect(fixture.finalizeProfilePhotoUpload).toHaveBeenCalledWith('opaque-photo-token'));
    expect(fixture.authorizeProfilePhotoUpload).toHaveBeenCalledWith({
      originalFileName: 'member.jpg', mimeType: 'image/jpeg', fileSize: 5,
    });
    expect(fixture.providerUpload).toHaveBeenCalledWith('https://storage.example.test/signed-upload',
      expect.objectContaining({ method: 'PUT', body: file }));
    expect(await screen.findByText('Profile photo updated.')).toBeTruthy();
    expect(fixture.refresh).toHaveBeenCalledOnce();
  });

  it('rejects invalid photo files before upload', async () => {
    render(<ProfilePage />);
    await screen.findByDisplayValue('Universiti Contoh');
    fireEvent.change(screen.getByLabelText(/Upload photo/), {
      target: { files: [new File(['gif'], 'member.gif', { type: 'image/gif' })] },
    });
    expect(await screen.findByText('Choose a JPEG, PNG or WebP photo.')).toBeTruthy();
    expect(fixture.authorizeProfilePhotoUpload).not.toHaveBeenCalled();
  });

  it('preserves the current avatar when private photo upload fails', async () => {
    fixture.getProfile.mockResolvedValue({ ...populatedProfile, photoUrl: 'https://legacy.example.test/photo.jpg' });
    fixture.authorizeProfilePhotoUpload.mockRejectedValue(new Error('private provider detail'));
    const user = userEvent.setup(); render(<ProfilePage />);
    const current = await screen.findByAltText('Profile photo of Aisyah Rahman');
    await user.upload(screen.getByLabelText(/Change photo/), new File(['png'], 'new.png', { type: 'image/png' }));
    await user.click(screen.getByRole('button', { name: 'Save photo' }));
    expect(await screen.findByText(/current photo is unchanged/)).toBeTruthy();
    expect(current.getAttribute('src')).toBe('https://legacy.example.test/photo.jpg');
    expect(document.body.textContent).not.toContain('private provider detail');
  });
});
