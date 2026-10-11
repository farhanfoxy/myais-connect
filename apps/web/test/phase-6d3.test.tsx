// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DigitalMembershipCard } from '@/components/membership/digital-membership-card';
import type { CurrentMembership, MemberProfileResponse } from '@/lib/api-client';
import { memberInitials, membershipDisplayName, membershipVerificationCode } from '@/lib/membership-card';

const fixture = vi.hoisted(() => ({ getCurrentMembership: vi.fn(), getProfile: vi.fn(), print: vi.fn(), share: vi.fn(),
  user: { id: 'user-id', email: 'member@example.test', fullName: 'Canonical Name', photoUrl: null as string | null,
    role: 'ASSOCIATE_MEMBER', accountStatus: 'ACTIVE' } }));

vi.mock('@/components/auth/auth-provider', () => ({ useAuth: () => ({ state: { status: 'authenticated', user: fixture.user } }) }));
vi.mock('@/lib/member-api', () => ({ createMemberApiClient: () => ({
  getCurrentMembership: fixture.getCurrentMembership, getProfile: fixture.getProfile,
}) }));

const membership: CurrentMembership = {
  membershipNumber: 'MYAIS-2026-000123', membershipTypeCode: 'ASSOCIATE', membershipTypeName: 'Associate Member',
  status: 'ACTIVE', startDate: '2026-03-01', expiryDate: '2027-02-28', votingEligible: false,
  activatedAt: '2026-03-01T01:02:03.000Z',
};
const profile: MemberProfileResponse = {
  email: 'member@example.test', photoUrl: null, exists: true,
  profile: { fullName: 'Profile Person', phoneNumber: null, identificationType: null, identificationNumber: null,
    nationality: null, dateOfBirth: null, gender: 'FEMALE', addressLine1: null, addressLine2: null, city: null,
    state: null, postcode: null, country: null, institution: null, occupation: null, department: null,
    areaOfExpertise: null, aisMember: false, aisMembershipNumber: null, aisMembershipExpiry: null,
    profileCompletionPercentage: 100 },
};

beforeEach(() => {
  fixture.getCurrentMembership.mockReset().mockResolvedValue(membership);
  fixture.getProfile.mockReset().mockResolvedValue(profile);
  fixture.print.mockReset(); fixture.share.mockReset().mockResolvedValue(undefined);
  fixture.user.photoUrl = null;
  profile.photoUrl = null;
  vi.stubGlobal('print', fixture.print);
  Reflect.deleteProperty(navigator, 'share');
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); Reflect.deleteProperty(navigator, 'share'); });

describe('digital membership card', () => {
  it('prioritizes the member number while keeping the legacy verification code secondary', async () => {
    const view = render(<DigitalMembershipCard />);
    expect((await screen.findAllByText('MYAIS-2026-000123')).length).toBeGreaterThan(0);
    expect(screen.getByText('Member number')).toBeTruthy();
    const officialLogo = screen.getByAltText('Association for Information Systems Malaysia Chapter (MyAIS)');
    expect(officialLogo.closest('.digital-card')).toBeTruthy();
    expect(officialLogo.closest('.official-myais-mark')).toBeTruthy();
    expect(officialLogo.getAttribute('src')).toContain('myais-official-logo.jpg');
    expect(view.container.querySelectorAll('.digital-card img')).toHaveLength(1);
    expect(view.container.querySelector('.digital-card-brand-row')?.textContent).toBe('MyAIS Connect');
    expect(screen.getAllByText('Associate Member').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 Mar 2026').length).toBeGreaterThan(0);
    expect(screen.getByText('28 Feb 2027')).toBeTruthy();
    expect(screen.getByText('Not eligible')).toBeTruthy();
    expect(screen.getAllByText(/V-000123/).length).toBeGreaterThan(0);
    expect(view.container.querySelector('.digital-card')?.textContent).not.toContain('V-000123');
    expect(screen.queryByText('Active member')).toBeNull();
    expect(document.body.textContent).not.toMatch(/user-id|applicationId|membershipTypeId|legacyBase44Id/);
  });

  it('uses Lifetime for null expiry and renders an honest unavailable state for null membership', async () => {
    fixture.getCurrentMembership.mockResolvedValue({ ...membership, expiryDate: null });
    const view = render(<DigitalMembershipCard />);
    expect(await screen.findByText('Lifetime')).toBeTruthy();
    view.unmount(); fixture.getCurrentMembership.mockResolvedValue(null);
    render(<DigitalMembershipCard />);
    expect(await screen.findByText('Your membership card is not available yet.')).toBeTruthy();
    expect(screen.queryByText('MYAIS-2026-000123')).toBeNull();
  });

  it('prefers profile name and presents personal names and honorifics in proper case', async () => {
    render(<DigitalMembershipCard />);
    expect(await screen.findByRole('heading', { name: 'Ms Profile Person' })).toBeTruthy();
    expect(profile.profile.fullName).toBe('Profile Person');
    expect(membershipDisplayName(null, 'Canonical Name', 'MALE')).toBe('Mr Canonical Name');
    expect(membershipDisplayName(null, 'Canonical Name', 'OTHER')).toBe('Canonical Name');
    expect(membershipDisplayName(null, null, null)).toBe('MyAIS Member');
    expect(membershipDisplayName('mr achmad farhan', null, null)).toBe('Mr Achmad Farhan');
    expect(membershipDisplayName('MS. nur aina', null, null)).toBe('Ms Nur Aina');
  });

  it('falls back to canonical name when profile is unavailable', async () => {
    fixture.getProfile.mockRejectedValue(new Error('profile unavailable'));
    render(<DigitalMembershipCard />);
    expect(await screen.findByRole('heading', { name: 'Canonical Name' })).toBeTruthy();
    expect(screen.queryByText(/profile unavailable/)).toBeNull();
  });

  it('shows initials without a photo and falls back when a canonical photo fails', async () => {
    render(<DigitalMembershipCard />);
    expect((await screen.findByLabelText('Initials for Ms Profile Person')).textContent).toBe('PP');
    cleanup();
    fixture.user.photoUrl = 'https://images.example.test/member.jpg';
    render(<DigitalMembershipCard />);
    const photo = await screen.findByAltText('Profile photo of Ms Profile Person');
    expect(photo.getAttribute('src')).toBe('https://images.example.test/member.jpg');
    fireEvent.error(photo);
    expect((await screen.findByLabelText('Initials for Ms Profile Person')).textContent).toBe('PP');
    expect(memberInitials('Mr Ahmad Bin Ali')).toBe('AA');
  });

  it('prefers the native profile response photo over the legacy canonical fallback', async () => {
    profile.photoUrl = 'https://signed.example.test/native-photo';
    fixture.user.photoUrl = 'https://legacy.example.test/photo';
    render(<DigitalMembershipCard />);
    const photo = await screen.findByAltText('Profile photo of Ms Profile Person');
    expect(photo.getAttribute('src')).toBe('https://signed.example.test/native-photo');
    expect(document.body.textContent).not.toContain('PROFILE_PHOTO');
  });

  it('prints with browser facilities and leaves download honestly unavailable', async () => {
    const user = userEvent.setup(); render(<DigitalMembershipCard />);
    await user.click(await screen.findByRole('button', { name: /Print card/ }));
    expect(fixture.print).toHaveBeenCalledOnce();
    expect((screen.getByRole('button', { name: /Download.*coming later/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shares only safe display details when Web Share is supported', async () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: fixture.share });
    const user = userEvent.setup(); render(<DigitalMembershipCard />);
    await user.click(await screen.findByRole('button', { name: 'Share details' }));
    expect(fixture.share).toHaveBeenCalledWith({ title: 'MyAIS Membership',
      text: 'MyAIS Membership\nMs Profile Person\nMYAIS-2026-000123' });
    expect(JSON.stringify(fixture.share.mock.calls)).not.toMatch(/jwt|user-id|https?:\/\//);
  });

  it('shows a disabled honest action when Web Share is unsupported and no fake QR functionality', async () => {
    render(<DigitalMembershipCard />);
    expect((await screen.findByRole('button', { name: 'Sharing unavailable' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/QR/)).toBeNull();
    expect(document.querySelector('canvas')).toBeNull();
    expect(membershipVerificationCode('ABC')).toBe('V-ABC');
  });
});
