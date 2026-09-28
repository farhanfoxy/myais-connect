// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardPage from '@/app/(protected)/dashboard/page';
import ProfilePage from '@/app/(protected)/profile/page';
import type { MemberProfileResponse, MembershipApplicationSummary } from '@/lib/api-client';

const fixture = vi.hoisted(() => ({
  refresh: vi.fn(async () => ({ status: 'authenticated' })),
  getProfile: vi.fn(), updateProfile: vi.fn(), getCurrentApplication: vi.fn(),
  listApplications: vi.fn(), getCurrentPayment: vi.fn(),
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
    getCurrentApplication: fixture.getCurrentApplication, listApplications: fixture.listApplications,
    getCurrentPayment: fixture.getCurrentPayment,
  }),
}));

const emptyProfile: MemberProfileResponse = {
  email: 'member@example.test', exists: false,
  profile: {
    fullName: 'Aisyah Rahman', phoneNumber: null, identificationType: null, identificationNumber: null,
    nationality: null, dateOfBirth: null, gender: null, addressLine1: null, addressLine2: null,
    city: null, state: null, postcode: null, country: null, institution: null, occupation: null,
    department: null, areaOfExpertise: null, aisMember: false, aisMembershipNumber: null,
    aisMembershipExpiry: null, profileCompletionPercentage: 0,
  },
};

const populatedProfile: MemberProfileResponse = {
  email: 'member@example.test', exists: true,
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

afterEach(cleanup);
beforeEach(() => {
  fixture.state.user.role = 'APPLICANT';
  fixture.refresh.mockClear();
  fixture.getProfile.mockReset().mockResolvedValue(populatedProfile);
  fixture.updateProfile.mockReset().mockResolvedValue(populatedProfile);
  fixture.getCurrentApplication.mockReset().mockResolvedValue(null);
  fixture.listApplications.mockReset().mockResolvedValue([]);
  fixture.getCurrentPayment.mockReset().mockResolvedValue(null);
});

describe('real member dashboard', () => {
  it('renders canonical identity, profile completion and an honest no-application state', async () => {
    render(<DashboardPage />);
    expect(screen.getByText('Welcome back, Aisyah Rahman.')).toBeTruthy();
    expect(await screen.findByText('100%')).toBeTruthy();
    expect(screen.getAllByText('No application record found').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Profile/ }).getAttribute('href')).toBe('/profile');
  });

  it('renders a current application with readable status and the correct next action', async () => {
    fixture.getCurrentApplication.mockResolvedValue(draft);
    fixture.listApplications.mockResolvedValue([draft]);
    render(<DashboardPage />);
    expect(await screen.findByText('Draft application')).toBeTruthy();
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /My application.*Continue application/ }).getAttribute('href'))
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
    render(<DashboardPage />);
    expect((await screen.findAllByText('MYAIS-APP-2026-000042')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getByText('Membership Active')).toBeTruthy();
    expect(screen.queryByText(/could not load your membership details/i)).toBeNull();
    expect(screen.queryByText('Check your eligibility')).toBeNull();
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
});
