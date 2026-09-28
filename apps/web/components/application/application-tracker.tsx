'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowRight, Check, Clock3, FileClock, MessageSquareText, RefreshCw, ShieldCheck,
} from 'lucide-react';
import { PageContainer, PageHeading, StatusBadge } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import type { MembershipApplicationSummary } from '@/lib/api-client';
import { createMemberApiClient } from '@/lib/member-api';
import { statusLabel, statusTone } from '@/lib/member-status';
import { cn } from '@/lib/utils';

const stages = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'UNDER_REVIEW', label: 'Under review' },
  { key: 'INFORMATION', label: 'Information' },
  { key: 'RECOMMENDED_FOR_APPROVAL', label: 'Recommended' },
  { key: 'APPROVED_PENDING_PAYMENT', label: 'Approved' },
  { key: 'PAYMENT', label: 'Payment' },
  { key: 'ACTIVE', label: 'Active' },
] as const;

const stageByStatus: Record<string, number> = {
  DRAFT: 0, SUBMITTED: 1, UNDER_REVIEW: 2, ADDITIONAL_INFORMATION_REQUIRED: 3,
  RECOMMENDED_FOR_APPROVAL: 4, APPROVED_PENDING_PAYMENT: 5,
  PAYMENT_SUBMITTED: 6, PAYMENT_UNDER_VERIFICATION: 6, ACTIVE: 7,
};

function formattedDate(value: string | null | undefined): string {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium' }).format(new Date(value));
}

function typeName(value: MembershipApplicationSummary['requestedMembershipType']): string {
  return value?.name || (value?.code ? statusLabel(value.code) : 'Not available');
}

function TrackerProgress({ status }: Readonly<{ status: string }>) {
  const current = stageByStatus[status];
  const mapped = current !== undefined;
  return <section className="tracker-progress-card" aria-labelledby="tracker-progress-heading">
    <header><div><p>Application journey</p><h2 id="tracker-progress-heading">Progress</h2></div>
      {!mapped && <span>Timeline position unavailable for this legacy status</span>}</header>
    <ol className="tracker-progress-list">
      {stages.map((stage, index) => {
        const complete = mapped && index < current;
        const active = mapped && index === current;
        return <li className={cn(complete && 'is-complete', active && 'is-current')} key={stage.key}
          aria-current={active ? 'step' : undefined}>
          <span className="tracker-stage-marker">{complete ? <Check size={15} /> : index + 1}</span>
          <strong>{stage.label}</strong><small>{active ? 'Current stage' : complete ? 'Completed' : 'Upcoming'}</small>
        </li>;
      })}
    </ol>
  </section>;
}

function TrackerAction({ application }: Readonly<{ application: MembershipApplicationSummary }>) {
  const hasRequest = application.openInformationRequests.length > 0;
  if (application.status === 'DRAFT') return <div className="tracker-action-panel"><div><strong>Continue your application</strong>
    <p>Your draft remains editable until it is submitted.</p></div><Link className="button button-primary" href="/my-application">
      Continue application <ArrowRight size={17} /></Link></div>;
  if (application.status === 'ADDITIONAL_INFORMATION_REQUIRED' && hasRequest) {
    return <div className="tracker-action-panel is-attention"><div><strong>Your response is needed</strong>
      <p>The committee needs additional information before review can continue.</p></div>
      <Link className="button button-primary" href="/my-application/respond">Respond to request <ArrowRight size={17} /></Link></div>;
  }
  const copy: Record<string, [string, string]> = {
    SUBMITTED: ['Application submitted', 'No member action is required while the committee receives your application.'],
    UNDER_REVIEW: ['Review in progress', 'No member action is required while the committee reviews your application.'],
    ADDITIONAL_INFORMATION_REQUIRED: ['Information required', 'No open request is currently available. Refresh if the request was just created.'],
    RECOMMENDED_FOR_APPROVAL: ['Awaiting final approval', 'Your application has been recommended and is awaiting an approval decision.'],
    APPROVED_PENDING_PAYMENT: ['Payment required', 'Online payment submission is coming in Phase 6D.2.'],
    PAYMENT_SUBMITTED: ['Payment submitted', 'Your receipt has been submitted and is awaiting verification.'],
    PAYMENT_UNDER_VERIFICATION: ['Payment verification', 'Your payment is being verified. No member action is required.'],
    ACTIVE: ['Membership active', 'Your membership application journey is complete.'],
    REJECTED: ['Application rejected', 'Review the decision details and reason shown above.'],
  };
  const content = copy[application.status] ?? ['Status recorded', `Your current status is ${statusLabel(application.status)}.`];
  return <div className="tracker-action-panel"><div><strong>{content[0]}</strong><p>{content[1]}</p></div>
    {application.status === 'APPROVED_PENDING_PAYMENT' && <Button disabled>Payment coming next</Button>}</div>;
}

export function ApplicationTracker() {
  const api = useMemo(() => createMemberApiClient(), []);
  const [applications, setApplications] = useState<MembershipApplicationSummary[] | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    setError(false); setApplications(null);
    api.listApplications().then(setApplications).catch(() => { setError(true); setApplications([]); });
  }, [api]);
  useEffect(() => {
    let active = true;
    api.listApplications().then(result => { if (active) setApplications(result); })
      .catch(() => { if (active) { setError(true); setApplications([]); } });
    return () => { active = false; };
  }, [api]);
  const application = applications?.[0] ?? null;

  return <PageContainer className="tracker-page">
    <PageHeading eyebrow="Membership" title="Application tracker"
      description="Follow your latest membership application and any action required from you." />
    {applications === null && <div className="application-loading" role="status"><Clock3 className="spin" /> Loading application progress…</div>}
    {error && <div className="application-load-error" role="alert"><AlertCircle />We could not load your application tracker.
      <button onClick={load}><RefreshCw size={15} /> Try again</button></div>}
    {!error && applications && !application && <section className="tracker-empty-state"><span><FileClock /></span><div>
      <h2>No application yet</h2><p>You have not started a MyAIS membership application.</p></div>
      <Link className="button button-primary" href="/my-application">Start application</Link></section>}
    {application && <>
      <section className="tracker-summary-card"><header><div><p>Latest application</p>
        <h2>{application.applicationNumber || 'Draft application'}</h2></div>
        <StatusBadge tone={statusTone(application.status)}>{statusLabel(application.status)}</StatusBadge></header>
        <dl><div><dt>Requested type</dt><dd>{typeName(application.requestedMembershipType)}</dd></div>
          <div><dt>Recommended type</dt><dd>{typeName(application.recommendedMembershipType)}</dd></div>
          <div><dt>Submitted</dt><dd>{formattedDate(application.submittedAt)}</dd></div>
          <div><dt>Last updated</dt><dd>{formattedDate(application.updatedAt)}</dd></div></dl>
        {application.status === 'REJECTED' && <div className="tracker-rejection" role="alert"><AlertCircle />
          <div><strong>Application rejected</strong><p>{application.rejectionReason || 'No rejection reason was provided.'}</p></div></div>}
        {application.latestReviewerRemarks?.trim() && application.status !== 'REJECTED' && <div className="tracker-remarks">
          <MessageSquareText /><div><strong>Latest reviewer remarks</strong><p>{application.latestReviewerRemarks}</p></div></div>}
      </section>
      <TrackerProgress status={application.status} />
      {application.openInformationRequests.length > 0 && <section className="tracker-section" aria-labelledby="open-requests-heading">
        <header><div><p>Action context</p><h2 id="open-requests-heading">Open information requests</h2></div>
          <StatusBadge tone="warning">{application.openInformationRequests.length} open</StatusBadge></header>
        <ul className="information-request-list">{application.openInformationRequests.map(request => <li key={request.id}>
          <span><MessageSquareText /></span><div><strong>{request.requestedByName || 'MyAIS Committee'}</strong>
            <p>{request.message}</p><small>Requested {formattedDate(request.createdAt)}{request.dueDate ? ` · Due ${formattedDate(request.dueDate)}` : ''}</small></div>
        </li>)}</ul></section>}
      {application.reviewHistory.length > 0 && <section className="tracker-section" aria-labelledby="review-history-heading">
        <header><div><p>Committee activity</p><h2 id="review-history-heading">Review history</h2></div></header>
        <ol className="review-history-list">{application.reviewHistory.map(review => <li key={review.id}>
          <span><ShieldCheck /></span><div><div><strong>{statusLabel(review.decision)}</strong><time dateTime={review.createdAt}>
            {formattedDate(review.createdAt)}</time></div>{review.remarks?.trim() && <p>{review.remarks}</p>}
            <small>By {review.reviewerName || 'MyAIS Committee'}</small></div></li>)}</ol></section>}
      <TrackerAction application={application} />
    </>}
  </PageContainer>;
}
