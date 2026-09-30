'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowLeft, BadgeCheck, Banknote, CheckCircle2, Download, FileText, LoaderCircle,
  ReceiptText, RefreshCw, ShieldCheck, UserRound, X,
} from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { PageContainer, PageHeading, StatusBadge } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import { ApiError, type ReviewerPaymentDetail, type ReviewerPaymentMutationResult } from '@/lib/api-client';
import { createAdminApiClient } from '@/lib/admin-api';
import { paymentMethodLabel, statusLabel, statusTone } from '@/lib/member-status';
import { canReviewPayments } from '@/lib/roles';
import { formatMoney } from './payment-queue';

type PaymentAction = 'verify' | 'reject';

function dateLabel(value: string | null | undefined): string {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function typeLabel(value: { code: string; name: string | null } | null | undefined): string {
  return value?.name || (value?.code ? statusLabel(value.code) : 'Not available');
}

function safeMutationError(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) return 'This payment changed on the server. Refresh before trying again.';
  if (error instanceof ApiError && error.status === 403) return 'This action is not permitted. Self-verification and role restrictions are enforced by MyAIS.';
  return 'We could not complete this payment action. No change was made.';
}

function PaymentActionDialog({ action, paymentId, close, complete }: Readonly<{
  action: PaymentAction;
  paymentId: string;
  close(): void;
  complete(result: ReviewerPaymentMutationResult): Promise<void>;
}>) {
  const api = useMemo(() => createAdminApiClient(), []);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const rejecting = action === 'reject';
  const title = rejecting ? 'Reject payment' : 'Verify payment';

  useEffect(() => {
    closeRef.current?.focus();
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape' && !pending) close(); };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, [close, pending]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (rejecting && !remarks.trim()) { setError('Rejection reason is required.'); return; }
    setPending(true);
    try {
      const result = rejecting
        ? await api.rejectReviewerPayment(paymentId, remarks.trim())
        : await api.verifyReviewerPayment(paymentId, remarks.trim());
      await complete(result);
    } catch (actionError) {
      setError(safeMutationError(actionError)); setPending(false);
    }
  }

  return <div className="review-dialog-backdrop" onPointerDown={event => {
    if (event.currentTarget === event.target && !pending) close();
  }}><section className="review-dialog payment-action-dialog" role="dialog" aria-modal="true"
    aria-labelledby="payment-action-title" aria-describedby="payment-action-description"><header><div><p>Payment decision</p>
      <h2 id="payment-action-title">{title}</h2></div><button ref={closeRef} aria-label="Close dialog" onClick={close}
        disabled={pending}><X /></button></header>
    <p id="payment-action-description">{rejecting
      ? 'Reject this receipt and return the application to payment submission.'
      : 'Confirm the payment evidence. MyAIS will activate membership using the existing server workflow.'}</p>
    <form onSubmit={submit}><label className="review-form-field"><span>{rejecting ? 'Rejection reason' : 'Treasurer remarks (optional)'}
      {rejecting && <strong>Required</strong>}</span><textarea rows={4} value={remarks} disabled={pending}
        aria-invalid={Boolean(error && rejecting && !remarks.trim()) || undefined}
        onChange={event => setRemarks(event.target.value)}
        placeholder={rejecting ? 'Explain why this payment evidence cannot be accepted' : 'Add concise verification context'} /></label>
      {error && <div className="review-action-error" role="alert"><AlertCircle />{error}</div>}
      <footer><Button variant="secondary" onClick={close} disabled={pending}>Cancel</Button>
        <Button variant={rejecting ? 'danger' : 'primary'} type="submit" disabled={pending}>
          {pending && <LoaderCircle className="spin" />}{pending ? 'Working…' : title}</Button></footer>
    </form></section></div>;
}

function PaymentActionPanel({ payment, role, open }: Readonly<{
  payment: ReviewerPaymentDetail; role: string | null; open(action: PaymentAction): void;
}>) {
  const actionable = ['SUBMITTED', 'UNDER_VERIFICATION'].includes(payment.status);
  const authorized = canReviewPayments(role);
  return <aside className="review-action-panel payment-action-panel" aria-labelledby="payment-actions-heading"><header><ShieldCheck /><div>
    <p>Verification controls</p><h2 id="payment-actions-heading">Payment decision</h2></div></header>
    {actionable && authorized ? <div className="review-action-stack payment-action-stack">
      <Button onClick={() => open('verify')}><BadgeCheck />Verify payment</Button>
      <Button variant="danger" onClick={() => open('reject')}>Reject payment</Button></div> : <div className="review-read-only">
      <FileText /><strong>Read-only state</strong><p>{authorized
        ? `No verification action is available for ${statusLabel(payment.status).toLowerCase()} payments.`
        : 'Your canonical role does not authorize payment verification.'}</p></div>}
  </aside>;
}

export function PaymentReviewDetail({ paymentId }: Readonly<{ paymentId: string }>) {
  const api = useMemo(() => createAdminApiClient(), []);
  const { state } = useAuth();
  const role = state.status === 'authenticated' ? state.user.role : null;
  const [payment, setPayment] = useState<ReviewerPaymentDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [action, setAction] = useState<PaymentAction | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try { setPayment(await api.getReviewerPayment(paymentId)); }
    catch { setLoadError(true); setPayment(null); }
  }, [api, paymentId]);

  useEffect(() => {
    let active = true;
    api.getReviewerPayment(paymentId).then(value => { if (active) setPayment(value); })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [api, paymentId]);

  async function complete(result: ReviewerPaymentMutationResult) {
    setAction(null);
    if (result.status === 'VERIFIED') {
      setNotice(result.membershipNumber
        ? `Payment verified. Membership ${result.membershipNumber} is now active.`
        : 'Payment verified and membership activation completed.');
    } else {
      setNotice('Payment rejected. The applicant can resubmit payment evidence without creating another application.');
    }
    await load();
  }

  async function openReceipt() {
    setNotice('');
    try {
      const target = await api.getReviewerPaymentReceiptDownload(paymentId);
      window.open(target.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setNotice('This private payment receipt is currently unavailable.');
    }
  }

  return <PageContainer className="admin-payment-detail-page">
    <Link className="admin-back-link" href="/admin/payments"><ArrowLeft />Back to payments</Link>
    <PageHeading eyebrow="Payment verification" title={payment?.paymentReference || 'Payment detail'}
      description="Review submitted evidence and complete the authorized payment decision." />
    {notice && <div className="review-live-notice" role="status" aria-live="polite"><CheckCircle2 />{notice}</div>}
    {!payment && !loadError && <div className="review-loading" role="status"><LoaderCircle className="spin" /><p>Loading payment detail…</p></div>}
    {loadError && <div className="application-load-error" role="alert"><AlertCircle />We could not load this payment.
      <button onClick={() => { setLoadError(false); void load(); }}><RefreshCw size={15} />Try again</button></div>}
    {payment && <div className="review-detail-layout payment-detail-layout"><div className="review-detail-main">
      <section className="review-detail-hero payment-detail-hero"><div><p>Payment state</p>
        <h2>{payment.paymentReference || 'Reference unavailable'}</h2><span>Submitted {dateLabel(payment.submittedAt)}</span></div>
        <div className="payment-detail-hero-state"><strong>{formatMoney(payment.totalAmount, payment.currency)}</strong>
          <StatusBadge tone={statusTone(payment.status)}>{statusLabel(payment.status)}</StatusBadge></div></section>

      <section className="review-detail-section" aria-labelledby="payment-applicant-heading"><header><UserRound /><div><p>Applicant</p>
        <h2 id="payment-applicant-heading">Applicant and application</h2></div></header><dl className="review-detail-grid">
        <div><dt>Name</dt><dd>{payment.applicant.displayName}</dd></div><div><dt>Email</dt><dd>{payment.applicant.email}</dd></div>
        <div><dt>Application reference</dt><dd>{payment.application?.applicationNumber || 'Not available'}</dd></div>
        <div><dt>Approved membership</dt><dd>{typeLabel(payment.application?.approvedMembershipType)}</dd></div>
        <div><dt>Application status</dt><dd>{statusLabel(payment.application?.status)}</dd></div>
      </dl></section>

      <section className="review-detail-section payment-summary-section" aria-labelledby="payment-summary-heading"><header><Banknote /><div>
        <p>Payment</p><h2 id="payment-summary-heading">Payment summary</h2></div></header>
        <div className="payment-fee-summary"><div><span>Entrance fee</span><strong>{formatMoney(payment.entranceFee, payment.currency)}</strong></div>
          <div><span>Membership fee</span><strong>{formatMoney(payment.membershipFee, payment.currency)}</strong></div>
          <div className="is-total"><span>Total received</span><strong>{formatMoney(payment.totalAmount, payment.currency)}</strong></div></div>
        <dl className="review-detail-grid"><div><dt>Payment method</dt><dd>{paymentMethodLabel(payment.paymentMethod)}</dd></div>
          <div><dt>Bank</dt><dd>{payment.bankName || 'Not provided'}</dd></div>
          <div><dt>Transaction reference</dt><dd>{payment.transactionReference || 'Not provided'}</dd></div>
          <div><dt>Payment date</dt><dd>{dateLabel(payment.paidAt)}</dd></div>
          <div><dt>Submitted</dt><dd>{dateLabel(payment.submittedAt)}</dd></div>
          <div><dt>Status</dt><dd>{statusLabel(payment.status)}</dd></div></dl>
      </section>

      <section className="review-detail-section payment-receipt-section" aria-labelledby="payment-receipt-heading"><header><ReceiptText /><div>
        <p>Private evidence</p><h2 id="payment-receipt-heading">Payment receipt</h2></div></header>
        <div className="payment-receipt-review"><span><ReceiptText /></span><div><strong>{payment.receiptDownloadAvailable
          ? 'Private receipt available' : 'Receipt unavailable'}</strong><p>{payment.receiptDownloadAvailable
          ? 'Access is authorized by MyAIS and expires shortly.' : 'This legacy payment has no native private receipt object.'}</p></div>
          {payment.receiptDownloadAvailable ? <Button variant="secondary" onClick={() => void openReceipt()}><Download />View receipt</Button> :
            <span className="review-document-unavailable">Unavailable</span>}</div>
      </section>

      <section className="review-detail-section" aria-labelledby="verification-heading"><header><BadgeCheck /><div><p>Verification</p>
        <h2 id="verification-heading">Decision information</h2></div></header><dl className="review-detail-grid">
        <div><dt>Verified</dt><dd>{dateLabel(payment.verifiedAt)}</dd></div>
        <div><dt>Treasurer remarks</dt><dd>{payment.treasurerRemarks || 'None recorded'}</dd></div>
        <div><dt>Rejection reason</dt><dd>{payment.rejectionReason || 'None recorded'}</dd></div>
      </dl>{payment.status === 'REJECTED' && <div className="review-detail-note is-danger"><strong>Applicant next step</strong>
        <p>The application remains approved. The applicant can submit corrected payment evidence through the existing payment flow.</p></div>}
      </section>
    </div><PaymentActionPanel payment={payment} role={role} open={next => { setNotice(''); setAction(next); }} /></div>}
    {action && <PaymentActionDialog action={action} paymentId={paymentId} close={() => setAction(null)} complete={complete} />}
  </PageContainer>;
}
