'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowLeft, CheckCircle2, Download, FileCheck2, FileText, LoaderCircle,
  MessageSquareText, RefreshCw, ShieldCheck, UserRound, X,
} from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { PageContainer, PageHeading, StatusBadge } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import { ApiError, type ReviewerApplicationDetail, type ReviewerMembershipTypeOption } from '@/lib/api-client';
import { createAdminApiClient } from '@/lib/admin-api';
import { statusLabel, statusTone } from '@/lib/member-status';
import { canFinallyApprove } from '@/lib/roles';

type ActionKind = 'start-review' | 'request-information' | 'recommend-approval' | 'approve' | 'reject';

const actionContent: Record<ActionKind, { title: string; description: string; submit: string }> = {
  'start-review': { title: 'Start application review', description: 'Move this application into active review.', submit: 'Start review' },
  'request-information': { title: 'Request additional information', description: 'Tell the applicant exactly what is needed.', submit: 'Send request' },
  'recommend-approval': { title: 'Recommend for approval', description: 'Confirm that this application is ready for final approval.', submit: 'Recommend approval' },
  approve: { title: 'Approve application', description: 'Select the membership type to be approved. The server will apply the correct outcome.', submit: 'Approve application' },
  reject: { title: 'Reject application', description: 'Provide a clear reason that will be recorded with this decision.', submit: 'Reject application' },
};

function dateLabel(value: string | null | undefined): string {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function dateOnly(value: string | null | undefined): string {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium' }).format(new Date(value));
}

function typeLabel(value: { code: string; name: string | null } | null): string {
  return value?.name || (value?.code ? statusLabel(value.code) : 'Not available');
}

function fileSize(value: number | null): string {
  if (!value) return 'Size unavailable';
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function safeActionError(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) return 'This application changed on the server. Refresh before trying again.';
  if (error instanceof ApiError && error.status === 403) return 'This action is not permitted. Self-review and role restrictions are enforced by MyAIS.';
  return 'We could not complete this review action. No change was made.';
}

function ReviewDialog({ kind, applicationId, membershipTypes, membershipTypesLoading, membershipTypesError,
  close, complete }: Readonly<{
  kind: ActionKind;
  applicationId: string;
  membershipTypes: ReviewerMembershipTypeOption[];
  membershipTypesLoading: boolean;
  membershipTypesError?: boolean;
  close(): void;
  complete(message: string): Promise<void>;
}>) {
  const api = useMemo(() => createAdminApiClient(), []);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [remarks, setRemarks] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [membershipTypeId, setMembershipTypeId] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const content = actionContent[kind];
  const requiresRemarks = kind === 'request-information' || kind === 'reject';

  useEffect(() => {
    closeRef.current?.focus();
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape' && !pending) close(); };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, [close, pending]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (requiresRemarks && !remarks.trim()) { setError('Remarks are required.'); return; }
    if (kind === 'approve' && !membershipTypeId) { setError('Select an approved membership type.'); return; }
    setPending(true);
    try {
      if (kind === 'start-review') await api.startApplicationReview(applicationId, remarks.trim());
      if (kind === 'request-information') await api.requestApplicationInformation(applicationId,
        { remarks: remarks.trim(), dueDate: dueDate || null });
      if (kind === 'recommend-approval') await api.recommendApplicationApproval(applicationId, remarks.trim());
      if (kind === 'approve') await api.approveApplication(applicationId,
        { approvedMembershipTypeId: membershipTypeId, remarks: remarks.trim() });
      if (kind === 'reject') await api.rejectApplication(applicationId, remarks.trim());
      await complete(`${content.title} completed.`);
    } catch (actionError) {
      setError(safeActionError(actionError)); setPending(false);
    }
  }

  return <div className="review-dialog-backdrop" onPointerDown={event => {
    if (event.currentTarget === event.target && !pending) close();
  }}><section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-dialog-title"
    aria-describedby="review-dialog-description"><header><div><p>Review action</p><h2 id="review-dialog-title">{content.title}</h2></div>
      <button ref={closeRef} aria-label="Close dialog" onClick={close} disabled={pending}><X /></button></header>
    <p id="review-dialog-description">{content.description}</p>
    <form onSubmit={submit}>
      {kind === 'approve' && <label className="review-form-field"><span>Approved membership type <strong>Required</strong></span>
        <select aria-label="Approved membership type" value={membershipTypeId} disabled={membershipTypesLoading || pending}
          onChange={event => setMembershipTypeId(event.target.value)} aria-invalid={Boolean(error && !membershipTypeId) || undefined}>
          <option value="">{membershipTypesLoading ? 'Loading membership types…' : membershipTypesError
            ? 'Membership types unavailable' : 'Select membership type'}</option>
          {membershipTypes.map(type => <option key={type.id} value={type.id}>{type.name} ({type.code})</option>)}
        </select></label>}
      {kind === 'approve' && membershipTypesError && <div className="review-action-error" role="alert"><AlertCircle />
        Active membership types could not be loaded. Close this dialog and try again.</div>}
      <label className="review-form-field"><span>{requiresRemarks ? 'Remarks' : 'Remarks (optional)'}
        {requiresRemarks && <strong>Required</strong>}</span><textarea value={remarks} disabled={pending} rows={4}
          onChange={event => setRemarks(event.target.value)} aria-invalid={Boolean(error && requiresRemarks && !remarks.trim()) || undefined}
          placeholder={kind === 'reject' ? 'Explain the reason for rejection' : 'Add concise reviewer context'} /></label>
      {kind === 'request-information' && <label className="review-form-field"><span>Due date <small>Optional</small></span>
        <input type="date" value={dueDate} disabled={pending} onChange={event => setDueDate(event.target.value)} /></label>}
      {error && <div className="review-action-error" role="alert"><AlertCircle />{error}</div>}
      <footer><Button variant="secondary" onClick={close} disabled={pending}>Cancel</Button>
        <Button variant={kind === 'reject' ? 'danger' : 'primary'} type="submit"
          disabled={pending || (kind === 'approve' && (membershipTypesLoading || membershipTypesError))}>
          {pending && <LoaderCircle className="spin" />} {pending ? 'Working…' : content.submit}</Button></footer>
    </form>
  </section></div>;
}

function ActionPanel({ application, role, open }: Readonly<{
  application: ReviewerApplicationDetail; role: string | null; open(action: ActionKind): void;
}>) {
  return <aside className="review-action-panel" aria-labelledby="review-actions-heading"><header><ShieldCheck /><div>
    <p>Workflow controls</p><h2 id="review-actions-heading">Available actions</h2></div></header>
    {application.status === 'SUBMITTED' && <Button onClick={() => open('start-review')}>Start review</Button>}
    {application.status === 'UNDER_REVIEW' && <div className="review-action-stack">
      <Button onClick={() => open('request-information')}>Request information</Button>
      <Button variant="secondary" onClick={() => open('recommend-approval')}>Recommend approval</Button>
      <Button variant="danger" onClick={() => open('reject')}>Reject application</Button></div>}
    {application.status === 'RECOMMENDED_FOR_APPROVAL' && <div className="review-action-stack">
      {canFinallyApprove(role) && <Button onClick={() => open('approve')}>Approve application</Button>}
      <Button variant="danger" onClick={() => open('reject')}>Reject application</Button></div>}
    {!['SUBMITTED', 'UNDER_REVIEW', 'RECOMMENDED_FOR_APPROVAL'].includes(application.status) && <div className="review-read-only">
      <FileCheck2 /><strong>Read-only state</strong><p>No reviewer action is available for {statusLabel(application.status).toLowerCase()} applications.</p></div>}
    {application.status === 'RECOMMENDED_FOR_APPROVAL' && !canFinallyApprove(role) && <p className="review-role-note">
      Final approval is restricted to the President and System Administrator.</p>}
  </aside>;
}

export function ApplicationReviewDetail({ applicationId }: Readonly<{ applicationId: string }>) {
  const { state } = useAuth();
  const api = useMemo(() => createAdminApiClient(), []);
  const [application, setApplication] = useState<ReviewerApplicationDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [action, setAction] = useState<ActionKind | null>(null);
  const [notice, setNotice] = useState('');
  const [types, setTypes] = useState<ReviewerMembershipTypeOption[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typesError, setTypesError] = useState(false);
  const role = state.status === 'authenticated' ? state.user.role : null;

  const load = useCallback(async () => {
    try { setApplication(await api.getReviewerApplication(applicationId)); }
    catch { setLoadError(true); setApplication(null); }
  }, [api, applicationId]);

  useEffect(() => {
    let active = true;
    api.getReviewerApplication(applicationId)
      .then(value => { if (active) setApplication(value); })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [api, applicationId]);

  function openAction(next: ActionKind) {
    setNotice(''); setAction(next);
    if (next === 'approve') {
      setTypesLoading(true); setTypes([]); setTypesError(false);
      api.listReviewerMembershipTypes().then(setTypes).catch(() => { setTypes([]); setTypesError(true); })
        .finally(() => setTypesLoading(false));
    }
  }

  async function complete(message: string) {
    setAction(null); setNotice(message); await load();
  }

  async function download(documentId: string) {
    setNotice('');
    try {
      const target = await api.getReviewerDocumentDownload(applicationId, documentId);
      window.open(target.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setNotice('This private document is currently unavailable.');
    }
  }

  return <PageContainer className="admin-application-detail-page">
    <Link className="admin-back-link" href="/admin/applications"><ArrowLeft />Back to applications</Link>
    <PageHeading eyebrow="Application review" title={application?.applicationNumber || 'Application detail'}
      description="Review the applicant record, supporting documents and decision history." />
    {notice && <div className="review-live-notice" role="status" aria-live="polite"><CheckCircle2 />{notice}</div>}
    {!application && !loadError && <div className="review-loading" role="status"><LoaderCircle className="spin" /><p>Loading application detail…</p></div>}
    {loadError && <div className="application-load-error" role="alert"><AlertCircle />We could not load this application.
      <button onClick={() => { setLoadError(false); void load(); }}><RefreshCw size={15} />Try again</button></div>}
    {application && <div className="review-detail-layout"><div className="review-detail-main">
      <section className="review-detail-hero"><div><p>Current state</p><h2>{application.applicationNumber || 'Reference unavailable'}</h2>
        <span>Updated {dateLabel(application.updatedAt)}</span></div>
        <StatusBadge tone={statusTone(application.status)}>{statusLabel(application.status)}</StatusBadge></section>

      <section className="review-detail-section" aria-labelledby="applicant-heading"><header><UserRound /><div><p>Applicant</p>
        <h2 id="applicant-heading">Applicant profile</h2></div></header><dl className="review-detail-grid">
        <div><dt>Name</dt><dd>{application.applicant.displayName}</dd></div><div><dt>Email</dt><dd>{application.applicant.email}</dd></div>
        <div><dt>Nationality</dt><dd>{application.applicant.nationality || 'Not available'}</dd></div>
        <div><dt>Date of birth</dt><dd>{dateOnly(application.applicant.dateOfBirth)}</dd></div>
        <div><dt>Institution</dt><dd>{application.applicant.institution || 'Not available'}</dd></div>
        <div><dt>AIS member</dt><dd>{application.applicant.aisMember ? 'Yes' : 'No'}</dd></div>
        {application.applicant.aisMember && <><div><dt>AIS membership number</dt><dd>{application.applicant.aisMembershipNumber || 'Not available'}</dd></div>
          <div><dt>AIS membership expiry</dt><dd>{dateOnly(application.applicant.aisMembershipExpiry)}</dd></div></>}
      </dl></section>

      <section className="review-detail-section" aria-labelledby="application-heading"><header><FileCheck2 /><div><p>Application</p>
        <h2 id="application-heading">Application assessment</h2></div></header><dl className="review-detail-grid">
        <div><dt>Requested type</dt><dd>{typeLabel(application.requestedMembershipType)}</dd></div>
        <div><dt>Recommended type</dt><dd>{typeLabel(application.recommendedMembershipType)}</dd></div>
        <div><dt>Eligibility score</dt><dd>{application.eligibilityScore === null ? 'Not available' : `${application.eligibilityScore} / 100`}</dd></div>
        <div><dt>Submitted</dt><dd>{dateLabel(application.submittedAt)}</dd></div>
        <div><dt>Reviewed</dt><dd>{dateLabel(application.reviewedAt)}</dd></div>
        <div><dt>Created</dt><dd>{dateLabel(application.createdAt)}</dd></div>
      </dl>{application.eligibilityExplanation && <div className="review-detail-note"><strong>Eligibility explanation</strong>
        <p>{application.eligibilityExplanation}</p></div>}
        {application.latestReviewerRemarks?.trim() && <div className="review-detail-note"><strong>Latest reviewer remarks</strong>
          <p>{application.latestReviewerRemarks}</p></div>}
        {application.rejectionReason?.trim() && <div className="review-detail-note is-danger"><strong>Rejection reason</strong>
          <p>{application.rejectionReason}</p></div>}
      </section>

      <section className="review-detail-section" aria-labelledby="documents-heading"><header><FileText /><div><p>Private files</p>
        <h2 id="documents-heading">Documents</h2></div></header>
        {application.documents.length === 0 ? <div className="review-section-empty">No documents are attached.</div> :
          <ul className="review-document-list">{application.documents.map(document => <li key={document.id}><span className="review-document-icon"><FileText /></span>
            <div><strong>{statusLabel(document.documentType)}</strong><p>{document.originalFileName || 'Filename unavailable'}</p>
              <small>{document.mimeType || 'Type unavailable'} · {fileSize(document.fileSize)} · Uploaded {dateOnly(document.createdAt)}</small>
              {document.reviewerRemarks?.trim() && <em>{document.reviewerRemarks}</em>}</div>
            <StatusBadge tone={statusTone(document.verificationStatus)}>{statusLabel(document.verificationStatus)}</StatusBadge>
            {document.downloadAvailable ? <Button variant="secondary" onClick={() => void download(document.id)}><Download />Open securely</Button> :
              <span className="review-document-unavailable">Legacy file unavailable</span>}</li>)}</ul>}
      </section>

      <section className="review-detail-section" aria-labelledby="history-heading"><header><MessageSquareText /><div><p>Decision trail</p>
        <h2 id="history-heading">Review history</h2></div></header>
        {application.reviewHistory.length === 0 ? <div className="review-section-empty">No review decisions recorded yet.</div> :
          <ol className="review-history-admin">{application.reviewHistory.map(review => <li key={review.id}><span><ShieldCheck /></span><div>
            <header><strong>{statusLabel(review.decision)}</strong><time dateTime={review.createdAt}>{dateLabel(review.createdAt)}</time></header>
            <p>{review.remarks?.trim() || 'No remarks recorded.'}</p><small>By {review.reviewerName || 'MyAIS Committee'}
              {review.previousStatus && review.newStatus ? ` · ${statusLabel(review.previousStatus)} to ${statusLabel(review.newStatus)}` : ''}</small>
          </div></li>)}</ol>}
      </section>
    </div><ActionPanel application={application} role={role} open={openAction} /></div>}
    {action && <ReviewDialog kind={action} applicationId={applicationId} membershipTypes={types}
      membershipTypesLoading={typesLoading} membershipTypesError={typesError}
      close={() => setAction(null)} complete={complete} />}
  </PageContainer>;
}
