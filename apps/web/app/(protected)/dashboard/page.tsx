'use client';

import { useEffect, useState } from 'react';
import {
  CalendarDays, CircleUserRound, CreditCard, FileClock, FileText, IdCard,
  Megaphone, ShieldCheck, UserRound,
} from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import {
  ContentCard, PageContainer, PageHeading, QuickActionTile, SectionHeading, StatusBadge,
  SummaryCard, WelcomeBanner,
} from '@/components/dashboard/dashboard-ui';
import type { CurrentMembership, CurrentPayment, MemberProfileResponse, MembershipApplicationSummary } from '@/lib/api-client';
import { createMemberApiClient } from '@/lib/member-api';
import { applicationAction, statusLabel, statusTone } from '@/lib/member-status';
import { humanizeEnum } from '@/lib/roles';

interface DashboardData {
  profile: MemberProfileResponse;
  currentApplication: MembershipApplicationSummary | null;
  applications: MembershipApplicationSummary[];
  payment: CurrentPayment | null;
  membership: CurrentMembership | null;
  membershipUnavailable: boolean;
}

function readableDate(value: string): string {
  return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

export default function DashboardPage() {
  const { state } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let active = true;
    const api = createMemberApiClient();
    const optionalPayment = api.getCurrentPayment().catch(() => null);
    const optionalMembership = api.getCurrentMembership().then(membership => ({ membership, unavailable: false }))
      .catch(() => ({ membership: null, unavailable: true }));
    void Promise.all([
      api.getProfile(), api.getCurrentApplication(), api.listApplications(), optionalPayment, optionalMembership,
    ]).then(([profile, currentApplication, applications, payment, membershipResult]) => {
      if (active) setData({ profile, currentApplication, applications, payment,
        membership: membershipResult.membership, membershipUnavailable: membershipResult.unavailable });
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [state.status]);

  if (state.status !== 'authenticated') return null;
  const { user } = state;
  const displayName = user.fullName?.trim() || user.email.split('@')[0] || 'Member';
  const role = humanizeEnum(user.role);
  const latestApplication = data?.currentApplication ?? data?.applications[0] ?? null;
  const actionLabel = applicationAction(latestApplication?.status);
  const isCurrent = Boolean(data?.currentApplication);
  const paymentAction = data?.payment?.payment?.status === 'REJECTED' ? 'Resubmit payment' :
    latestApplication?.status === 'APPROVED_PENDING_PAYMENT' ? 'Submit payment' :
      data?.payment ? 'View payment details' : 'No payment due';

  return <PageContainer className="dashboard-page">
    <PageHeading eyebrow="Member workspace" title="Dashboard"
      description="Your membership profile, application progress and next steps in one place." />
    <WelcomeBanner role={role} name={displayName} membershipActive={data?.membership?.status === 'ACTIVE'} context={latestApplication
      ? `Your latest application is ${statusLabel(latestApplication.status).toLowerCase()}.`
      : 'Complete your profile when you are ready to begin your membership journey.'} />

    {loadError && <div className="data-message data-message-error" role="alert">
      We could not load your membership details. Refresh the page to try again.
    </div>}

    <section className="dashboard-section" aria-labelledby="account-summary-heading">
      <SectionHeading id="account-summary-heading" title="At a glance"
        description="Current information from the secure MyAIS API." />
      {!data && !loadError ? <div className="summary-grid" aria-label="Loading dashboard information">
        {[1, 2, 3].map(item => <div className="summary-card summary-card-loading" key={item} />)}
      </div> : data && <div className="summary-grid">
        <SummaryCard icon={ShieldCheck} label="Account access" value={statusLabel(user.accountStatus)}
          supporting="Canonical account status" />
        <SummaryCard icon={CircleUserRound} label="Profile completeness"
          value={`${data.profile.profile.profileCompletionPercentage}%`}
          supporting={data.profile.profile.profileCompletionPercentage === 100 ? 'Ready for application' : 'Complete your profile to apply'} />
        <SummaryCard icon={FileClock} label="Application"
          value={latestApplication ? statusLabel(latestApplication.status) : 'No application'}
          supporting={latestApplication?.applicationNumber ?? 'No application record found'} />
        {data.payment && <SummaryCard icon={CreditCard} label="Payment"
          value={statusLabel(data.payment.payment?.status ?? data.payment.applicationStatus)}
          supporting={data.payment.payment?.paymentReference ?? 'Payment linked to current application'} />}
        {data.membership && <SummaryCard icon={IdCard} label="Membership" value={data.membership.membershipTypeName ||
          statusLabel(data.membership.membershipTypeCode)} supporting={data.membership.membershipNumber || 'Membership number unavailable'} />}
      </div>}
    </section>

    <section className="dashboard-section" aria-labelledby="quick-actions-heading">
      <SectionHeading id="quick-actions-heading" title="Quick actions"
        description="Access your membership details and available next steps." />
      <div className="quick-action-grid">
        <QuickActionTile icon={UserRound} label="Profile" supporting="View and update" href="/profile" />
        <QuickActionTile icon={FileText} label={latestApplication ? 'My application' : 'Apply'}
          supporting={actionLabel} href="/my-application" />
        <QuickActionTile icon={FileClock} label="Application tracker" supporting="View progress" href="/my-application/tracker" />
        <QuickActionTile icon={CreditCard} label="Payment" supporting={paymentAction}
          {...(data?.payment ? { href: '/my-application/payment' } : { disabled: true })} />
        <QuickActionTile icon={IdCard} label="Membership card"
          supporting={data?.membership ? data.membership.membershipNumber || 'View active membership' :
            data?.membershipUnavailable ? 'Temporarily unavailable' : 'No active membership'}
          {...(data?.membership ? { href: '/my-card' } : { disabled: true })} />
        <QuickActionTile icon={Megaphone} label="Announcements" supporting="Coming in a later phase" disabled />
        <QuickActionTile icon={CalendarDays} label="Events" supporting="Coming in a later phase" disabled />
      </div>
    </section>

    <section className="dashboard-section" aria-labelledby="current-application-heading">
      <SectionHeading id="current-application-heading" title={isCurrent ? 'Current application' : 'Recent application'}
        description={isCurrent ? 'Your active membership application status.' : 'Your latest application history, when available.'} />
      {!data && !loadError ? <ContentCard className="application-preview application-preview-loading"><span /></ContentCard> :
        latestApplication ? <ContentCard className="application-preview">
          <span className="application-preview-icon"><FileText size={21} /></span>
          <div><h3>{latestApplication.applicationNumber ?? 'Draft application'}</h3>
            <p>{latestApplication.requestedMembershipType?.name ?? latestApplication.requestedMembershipType?.code ?? 'Membership type not selected'}
              {' · '}Updated {readableDate(latestApplication.updatedAt)}</p></div>
          <div className="application-preview-state"><StatusBadge tone={statusTone(latestApplication.status)}>
            {statusLabel(latestApplication.status)}</StatusBadge><span>{actionLabel}</span></div>
        </ContentCard> : <ContentCard className="application-preview empty-application">
          <span className="application-preview-icon"><FileText size={21} /></span>
          <div><h3>No application record found</h3>
            <p>Complete your profile first, then begin your membership application.</p></div>
          <StatusBadge>Not started</StatusBadge>
        </ContentCard>}
    </section>
  </PageContainer>;
}
