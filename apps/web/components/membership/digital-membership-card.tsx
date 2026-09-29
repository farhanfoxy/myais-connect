'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  AlertCircle, CheckCircle2, Download, IdCard, LoaderCircle, Printer, RefreshCw, Share2, ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { PageContainer, PageHeading, StatusBadge } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import type { CurrentMembership, MemberProfileResponse } from '@/lib/api-client';
import { createMemberApiClient } from '@/lib/member-api';
import { memberInitials, membershipDisplayName, membershipVerificationCode } from '@/lib/membership-card';
import { statusLabel } from '@/lib/member-status';

function formattedDate(value: string | null): string {
  if (!value) return 'Not specified';
  const date = new Date(`${value}T00:00:00+08:00`);
  return Number.isNaN(date.valueOf()) ? 'Not specified' :
    new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }).format(date);
}

function validatedMembership(value: CurrentMembership | null): CurrentMembership | null {
  if (value && (value.status !== 'ACTIVE' ||
    (value.membershipNumber !== null && typeof value.membershipNumber !== 'string') ||
    (value.membershipTypeName !== null && typeof value.membershipTypeName !== 'string'))) {
    throw new Error('Malformed membership response');
  }
  return value;
}

function MemberPortrait({ photoUrl, name }: Readonly<{ photoUrl: string | null; name: string }>) {
  const [failed, setFailed] = useState(false);
  if (!photoUrl || failed) return <span className="membership-card-initials" aria-label={`Initials for ${name}`}>
    {memberInitials(name)}</span>;
  return <span className="membership-card-photo">
    {/* Existing canonical profile photos can be hosted outside the Next.js image allowlist. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={photoUrl} alt={`Profile photo of ${name}`} onError={() => setFailed(true)} />
  </span>;
}

function CardFront({ membership, profileName, gender, canonicalName, photoUrl }: Readonly<{
  membership: CurrentMembership; profileName: string | null; gender: MemberProfileResponse['profile']['gender'];
  canonicalName: string | null; photoUrl: string | null;
}>) {
  const displayName = membershipDisplayName(profileName, canonicalName, gender);
  return <article className="digital-card" aria-labelledby="digital-card-name">
    <div className="digital-card-glow" aria-hidden="true" />
    <header><div className="digital-card-brand"><Image src="/brand/myais-connect-mark.png" width={1200} height={1200}
      sizes="48px" alt="" /><div><strong>MyAIS</strong><span>CONNECT</span></div></div>
      <span className="digital-card-active"><i />Active member</span></header>
    <div className="digital-card-member"><MemberPortrait photoUrl={photoUrl} name={displayName} /><div>
      <p>{membership.membershipTypeName || statusLabel(membership.membershipTypeCode)}</p>
      <h2 id="digital-card-name">{displayName.toUpperCase()}</h2>
      <span>{membership.membershipNumber || 'Number not available'}</span></div></div>
    <dl><div><dt>Valid from</dt><dd>{formattedDate(membership.startDate)}</dd></div>
      <div><dt>Valid until</dt><dd>{membership.expiryDate ? formattedDate(membership.expiryDate) : 'Lifetime'}</dd></div>
      <div><dt>Verification code</dt><dd>{membershipVerificationCode(membership.membershipNumber)}</dd></div></dl>
    <footer><span>Association membership credential</span><ShieldCheck aria-hidden="true" /></footer>
  </article>;
}

export function DigitalMembershipCard() {
  const { state } = useAuth();
  const api = useMemo(() => createMemberApiClient(), []);
  const [membership, setMembership] = useState<CurrentMembership | null | undefined>(undefined);
  const [profile, setProfile] = useState<MemberProfileResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const load = useCallback(() => {
    setLoadError(false); setMembership(undefined);
    Promise.all([api.getCurrentMembership(), api.getProfile().catch(() => null)]).then(([nextMembership, nextProfile]) => {
      setMembership(validatedMembership(nextMembership)); setProfile(nextProfile);
    }).catch(() => { setLoadError(true); setMembership(null); setProfile(null); });
  }, [api]);
  useEffect(() => {
    let active = true;
    Promise.all([api.getCurrentMembership(), api.getProfile().catch(() => null)]).then(([nextMembership, nextProfile]) => {
      if (active) { setMembership(validatedMembership(nextMembership)); setProfile(nextProfile); }
    }).catch(() => { if (active) { setLoadError(true); setMembership(null); setProfile(null); } });
    return () => { active = false; };
  }, [api]);

  if (state.status !== 'authenticated') return null;
  const shareSupported = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const printSupported = typeof window !== 'undefined' && typeof window.print === 'function';
  const displayName = membershipDisplayName(profile?.profile.fullName, state.user.fullName, profile?.profile.gender);
  async function share() {
    if (!membership || !shareSupported) return;
    try {
      await navigator.share({ title: 'MyAIS Membership',
        text: `MyAIS Membership\n${displayName}\n${membership.membershipNumber || 'Membership number unavailable'}` });
      setShareMessage('Membership details shared.');
    } catch { setShareMessage('Sharing was cancelled or could not be completed.'); }
  }

  return <PageContainer className="membership-card-page">
    <PageHeading eyebrow="Membership" title="Digital membership card"
      description="Your current MyAIS membership credential, sourced from your active membership record." />
    {membership === undefined && <div className="application-loading" role="status"><LoaderCircle className="spin" /> Loading membership card…</div>}
    {loadError && <div className="application-load-error" role="alert"><AlertCircle />We could not load your membership card.
      <button onClick={load}><RefreshCw size={15} /> Try again</button></div>}
    {!loadError && membership === null && <section className="tracker-empty-state"><span><IdCard /></span><div>
      <h2>Your membership card is not available yet.</h2><p>An active Membership record is required before MyAIS can display a card.</p></div>
      <Link className="button button-secondary" href="/my-application/tracker">Application tracker</Link></section>}
    {membership && <div className="membership-card-layout">
      <div className="membership-card-stage"><CardFront membership={membership} profileName={profile?.profile.fullName ?? null}
        gender={profile?.profile.gender ?? null}
        canonicalName={state.user.fullName} photoUrl={state.user.photoUrl} /></div>
      <aside className="membership-card-details" aria-labelledby="membership-details-heading">
        <header><StatusBadge tone="success"><CheckCircle2 size={13} /> Active</StatusBadge>
          <h2 id="membership-details-heading">Membership details</h2><p>This card reflects your current active Membership record.</p></header>
        <dl><div><dt>Membership number</dt><dd>{membership.membershipNumber || 'Not available'}</dd></div>
          <div><dt>Membership type</dt><dd>{membership.membershipTypeName || statusLabel(membership.membershipTypeCode)}</dd></div>
          <div><dt>Status</dt><dd>Active</dd></div><div><dt>Voting eligibility</dt><dd>{membership.votingEligible ? 'Eligible' : 'Not eligible'}</dd></div>
          <div><dt>Activated</dt><dd>{membership.activatedAt ? new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium',
            timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(membership.activatedAt)) : 'Not specified'}</dd></div></dl>
        <div className="membership-verification-note"><ShieldCheck /><div><strong>Display verification code</strong>
          <p>{membershipVerificationCode(membership.membershipNumber)} is preserved from the legacy card display. Public online verification is not currently available.</p></div></div>
        <div className="membership-card-actions"><Button onClick={() => window.print()} disabled={!printSupported}>
          <Printer /> {printSupported ? 'Print card' : 'Printing unavailable'}</Button>
          {shareSupported && <Button variant="secondary" onClick={() => void share()}><Share2 /> Share details</Button>}
          {!shareSupported && <Button variant="secondary" disabled><Share2 /> Sharing unavailable</Button>}
          <Button variant="ghost" disabled><Download /> Download — coming later</Button></div>
        {shareMessage && <p className="membership-share-message" role="status">{shareMessage}</p>}
      </aside>
    </div>}
  </PageContainer>;
}
