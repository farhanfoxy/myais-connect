'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays, CircleUserRound, CreditCard, FileClock, FileText, IdCard, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import {
  ContentCard, MembershipJourney, PageContainer, PageHeading, SectionHeading, StatusBadge,
  SummaryCard, WelcomeBanner,
} from '@/components/dashboard/dashboard-ui';
import { MembershipCardVisual } from '@/components/membership/digital-membership-card';
import { EventCard } from '@/components/events/event-card';
import { NewsList } from '@/components/news/news-list';
import type { JourneyStep } from '@/components/dashboard/dashboard-ui';
import type { CurrentMembership, CurrentPayment, EventRecord, MemberProfileResponse, MembershipApplicationSummary } from '@/lib/api-client';
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

const reviewInProgress = new Set(['SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFORMATION_REQUIRED', 'RECOMMENDED_FOR_APPROVAL']);
const reviewComplete = new Set(['APPROVED_PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAYMENT_UNDER_VERIFICATION', 'ACTIVE']);

function membershipJourney(data: DashboardData, latestApplication: MembershipApplicationSummary | null): JourneyStep[] {
  const applicationStatus = latestApplication?.status;
  const paymentStatus = data.payment?.payment?.status;
  const membershipActive = data.membership?.status === 'ACTIVE';
  const profileComplete = data.profile.profile.profileCompletionPercentage === 100;
  const applicationSubmitted = membershipActive || Boolean(latestApplication?.submittedAt) ||
    Boolean(applicationStatus && applicationStatus !== 'DRAFT');
  const reviewApproved = membershipActive || Boolean(applicationStatus && reviewComplete.has(applicationStatus));
  const paymentComplete = membershipActive || paymentStatus === 'VERIFIED';

  return [
    { label: 'Profile', detail: profileComplete ? 'Complete' : `${data.profile.profile.profileCompletionPercentage}% complete`,
      state: profileComplete ? 'complete' : 'current' },
    { label: 'Application', detail: !latestApplication ? 'Not started' : applicationSubmitted ? 'Submitted' : 'Draft in progress',
      state: applicationSubmitted ? 'complete' : profileComplete ? 'current' : 'upcoming' },
    { label: 'Review', detail: applicationStatus === 'REJECTED' ? 'Not approved' : reviewApproved ? 'Approved' :
      applicationStatus && reviewInProgress.has(applicationStatus) ? statusLabel(applicationStatus) : 'Not started',
      state: applicationStatus === 'REJECTED' ? 'attention' : reviewApproved ? 'complete' :
        applicationStatus && reviewInProgress.has(applicationStatus) ? 'current' : 'upcoming' },
    { label: 'Payment', detail: paymentComplete ? 'Verified' : paymentStatus ? statusLabel(paymentStatus) :
      applicationStatus === 'APPROVED_PENDING_PAYMENT' ? 'Ready to submit' : 'Not available',
      state: paymentComplete ? 'complete' : data.payment || applicationStatus === 'APPROVED_PENDING_PAYMENT' ? 'current' : 'upcoming' },
    { label: 'Membership', detail: membershipActive ? 'Active' : data.membershipUnavailable ? 'Unavailable' : 'Not active',
      state: membershipActive ? 'complete' : 'upcoming' },
  ];
}

export default function DashboardPage() {
  const { state } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [events, setEvents] = useState<EventRecord[] | null>(null);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let active = true;
    const api = createMemberApiClient();
    void api.listEvents({ limit: 2 }).then(value => { if (active) setEvents(value); }).catch(() => { if (active) setEvents([]); });
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
  const nextAction = data ? data.profile.profile.profileCompletionPercentage < 100 ? 'Complete profile' :
    data.membership?.status === 'ACTIVE' ? 'View membership card' : data.membershipUnavailable && latestApplication?.status === 'ACTIVE' ?
      'Membership temporarily unavailable' :
      applicationAction(latestApplication?.status) : 'Loading progress';
  const activeMembership = data?.membership?.status === 'ACTIVE' ? data.membership : null;
  const journey = data ? membershipJourney(data, latestApplication) : [];
  const nextHref = data ? data.profile.profile.profileCompletionPercentage < 100 ? '/profile' :
    activeMembership ? '/my-card' : latestApplication?.status === 'ADDITIONAL_INFORMATION_REQUIRED' ? '/my-application/respond' :
      latestApplication?.status === 'APPROVED_PENDING_PAYMENT' || latestApplication?.status === 'PAYMENT_SUBMITTED' ||
        latestApplication?.status === 'PAYMENT_UNDER_VERIFICATION' ? '/my-application/payment' :
        latestApplication?.status && latestApplication.status !== 'DRAFT' ? '/my-application/tracker' : '/my-application' : undefined;

  return <PageContainer className="dashboard-page">
    <PageHeading eyebrow="Member workspace" title="Dashboard"
      description="Your membership profile, application progress and next steps in one place." />
    <WelcomeBanner role={role} name={displayName} membershipActive={data?.membership?.status === 'ACTIVE'} context={latestApplication
      ? `Your latest application is ${statusLabel(latestApplication.status).toLowerCase()}.`
      : 'Complete your profile when you are ready to begin your membership journey.'} />

    {loadError && <div className="data-message data-message-error" role="alert">
      We could not load your membership details. Refresh the page to try again.
    </div>}

    {data && (activeMembership ? <section className="active-member-priority" aria-label="Active membership overview">
      <MembershipJourney steps={journey} nextAction={nextAction} nextHref={nextHref} compact />
      <div className="dashboard-card-highlight"><header><div><p>Digital membership card</p>
        <h2>Your member identity</h2></div><Link className="dashboard-card-link" href="/my-card">Download card</Link></header>
        <MembershipCardVisual membership={activeMembership} profileName={data.profile.profile.fullName}
          gender={data.profile.profile.gender} canonicalName={user.fullName} photoUrl={data.profile.photoUrl ?? user.photoUrl} /></div>
    </section> : <MembershipJourney steps={journey} nextAction={nextAction} nextHref={nextHref} />)}

    {data?.membershipUnavailable && <div className="dashboard-inline-notice" role="status">
      Membership card temporarily unavailable. Your other dashboard information is still available.
    </div>}

    <section className="dashboard-section event-showcase" aria-labelledby="featured-events-heading">
      <SectionHeading id="featured-events-heading" title="Featured events"
        description="Discover upcoming MyAIS and AIS professional activities." />
      {events === null ? <div className="dashboard-event-loading" role="status"><span /><span /></div> : events.length > 0 ? <>
        <div className="dashboard-event-grid">{events.map(event => <EventCard event={event} compact key={event.id} />)}</div>
        <Link className="dashboard-events-more" href="/events">View more events</Link></> :
        <div className="event-empty-state"><span className="event-empty-icon"><CalendarDays size={23} /></span><div>
          <h3>No upcoming events yet</h3><p>Published MyAIS events will appear here when they are scheduled.</p></div>
          <Link className="button button-secondary" href="/events">View more events</Link></div>}
    </section>

    <section className="dashboard-section" aria-labelledby="latest-news-heading">
      <SectionHeading id="latest-news-heading" title="Latest news" description="Recent official MyAIS announcements." />
      <NewsList limit={3} /><Link className="dashboard-events-more" href="/news">View all news</Link>
    </section>

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
