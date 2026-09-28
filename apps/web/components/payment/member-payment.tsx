'use client';

import Link from 'next/link';
import {
  AlertCircle, ArrowLeft, CheckCircle2, Clock3, FileCheck2, FileText, Landmark,
  LoaderCircle, LockKeyhole, ReceiptText, RefreshCw, ShieldCheck, UploadCloud,
} from 'lucide-react';
import {
  useCallback, useEffect, useMemo, useRef, useState,
  type ChangeEvent, type FormEvent,
} from 'react';
import { PageContainer, PageHeading, StatusBadge } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import {
  ApiError, type CurrentPayment, type PaymentMethod, type PaymentSubmissionResult,
} from '@/lib/api-client';
import { createMemberApiClient } from '@/lib/member-api';
import { paymentMethodLabel, statusLabel, statusTone } from '@/lib/member-status';
import {
  PAYMENT_RECEIPT_ACCEPT, uploadPaymentReceipt, validatePaymentReceipt,
} from '@/lib/payment-receipt-upload';

type SubmissionStage = 'authorizing' | 'uploading' | 'submitting';
type FieldErrors = Partial<Record<'method' | 'transactionReference' | 'receipt', string>>;

const paymentMethods: PaymentMethod[] = ['BANK_TRANSFER', 'ONLINE_BANKING', 'CASH_DEPOSIT'];

function formattedDate(value: string | null | undefined): string {
  if (!value) return 'Not provided';
  const date = new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value);
  return Number.isNaN(date.valueOf()) ? 'Not provided' :
    new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeZone: 'Asia/Kuala_Lumpur' }).format(date);
}

function formattedMoney(value: string | null, currency: string | null): string {
  if (value === null) return 'Not specified';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  if (currency === 'MYR') return new Intl.NumberFormat('en-MY', {
    style: 'currency', currency: 'MYR', currencyDisplay: 'narrowSymbol', minimumFractionDigits: 2,
  }).format(amount);
  return `${currency || 'Amount'} ${amount.toFixed(2)}`;
}

function receiptTypeLabel(file: File): string {
  if (file.type === 'application/pdf') return 'PDF';
  if (file.type === 'image/png') return 'PNG';
  return 'JPEG';
}

function PaymentSummary({ current }: { current: CurrentPayment }) {
  const payment = current.payment;
  if (!payment) return null;
  return <aside className="payment-summary" aria-labelledby="payment-summary-title">
    <header><span><ReceiptText /></span><div><p>Payment summary</p><h2 id="payment-summary-title">
      {current.approvedMembershipType?.name || statusLabel(current.approvedMembershipType?.code)}</h2></div></header>
    <dl>
      <div><dt>Entrance fee</dt><dd>{formattedMoney(payment.entranceFee, payment.currency)}</dd></div>
      <div><dt>Membership fee</dt><dd>{formattedMoney(payment.membershipFee, payment.currency)}</dd></div>
      <div className="payment-total"><dt>Total due</dt><dd>{formattedMoney(payment.totalAmount, payment.currency)}</dd></div>
    </dl>
    <div className="payment-summary-reference"><span>Payment reference</span>
      <strong>{payment.paymentReference || 'Assigned on submission'}</strong></div>
    <div className="private-storage-note"><LockKeyhole size={16} />Your receipt is stored privately and is only available to authorized reviewers.</div>
  </aside>;
}

function PaymentReadOnly({ current }: { current: CurrentPayment }) {
  const payment = current.payment!;
  const verified = payment.status === 'VERIFIED';
  const rejected = payment.status === 'REJECTED';
  return <div className="payment-layout">
    <section className="payment-state-panel">
      <span className={`payment-state-icon ${verified ? 'is-success' : rejected ? 'is-danger' : ''}`}>
        {verified ? <CheckCircle2 /> : rejected ? <AlertCircle /> : <Clock3 />}
      </span>
      <StatusBadge tone={statusTone(payment.status)}>{payment.status === 'SUBMITTED' ? 'Awaiting verification' :
        payment.status === 'UNDER_VERIFICATION' ? 'Payment under verification' : statusLabel(payment.status)}</StatusBadge>
      <h2>{verified ? 'Payment verified' : rejected ? 'Payment needs attention' :
        payment.status === 'UNDER_VERIFICATION' ? 'Payment under verification' : 'Payment submitted'}</h2>
      <p>{verified ? 'Your payment has been verified and your membership activation is complete.' :
        rejected ? 'Review the feedback below, then submit a replacement receipt when payment submission is available.' :
        'Your payment details are with the MyAIS team. No further action is needed while verification is in progress.'}</p>
      <dl className="payment-detail-list">
        <div><dt>Application</dt><dd>{current.applicationNumber || 'Not assigned'}</dd></div>
        <div><dt>Payment reference</dt><dd>{payment.paymentReference || 'Not assigned'}</dd></div>
        <div><dt>Method</dt><dd>{paymentMethodLabel(payment.paymentMethod)}</dd></div>
        <div><dt>Transaction reference</dt><dd>{payment.transactionReference || 'Not provided'}</dd></div>
        <div><dt>Bank</dt><dd>{payment.bankName || 'Not provided'}</dd></div>
        <div><dt>Payment date</dt><dd>{formattedDate(payment.paidAt)}</dd></div>
        <div><dt>Submitted</dt><dd>{formattedDate(payment.submittedAt)}</dd></div>
      </dl>
      {(payment.rejectionReason || payment.treasurerRemarks) && <div className="payment-review-note">
        <strong>Reviewer feedback</strong><p>{payment.rejectionReason || payment.treasurerRemarks}</p></div>}
      <div className="payment-page-actions"><Link className="button button-secondary" href="/my-application/tracker">
        <ArrowLeft size={17} /> Application tracker</Link>
        {verified && <span className="button button-ghost is-disabled" aria-disabled="true">Membership card coming next</span>}
      </div>
    </section>
    <PaymentSummary current={current} />
  </div>;
}

export function MemberPayment() {
  const api = useMemo(() => createMemberApiClient(), []);
  const [current, setCurrent] = useState<CurrentPayment | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [transactionReference, setTransactionReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [stage, setStage] = useState<SubmissionStage | null>(null);
  const [submitted, setSubmitted] = useState<PaymentSubmissionResult | null>(null);
  const methodRef = useRef<HTMLSelectElement>(null);
  const transactionRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLInputElement>(null);
  const submitErrorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setLoadError(false); setCurrent(undefined);
    api.getCurrentPayment().then(setCurrent).catch(() => { setLoadError(true); setCurrent(null); });
  }, [api]);
  useEffect(() => {
    let active = true;
    api.getCurrentPayment().then(value => { if (active) setCurrent(value); })
      .catch(() => { if (active) { setLoadError(true); setCurrent(null); } });
    return () => { active = false; };
  }, [api]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setFile(next); setErrors(previous => ({ ...previous, receipt: undefined }));
    if (next) {
      const error = validatePaymentReceipt(next);
      if (error) { setFile(null); setErrors(previous => ({ ...previous, receipt: error })); }
    }
    event.target.value = '';
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current?.payment || current.applicationStatus !== 'APPROVED_PENDING_PAYMENT' || stage) return;
    const nextErrors: FieldErrors = {};
    if (!method) nextErrors.method = 'Choose a payment method.';
    if (!transactionReference.trim()) nextErrors.transactionReference = 'Enter the transaction reference.';
    if (!file) nextErrors.receipt = 'Choose a payment receipt.';
    else nextErrors.receipt = validatePaymentReceipt(file) || undefined;
    setErrors(nextErrors); setSubmitError('');
    const firstError = Object.keys(nextErrors).find(key => nextErrors[key as keyof FieldErrors]);
    if (firstError) {
      if (firstError === 'method') methodRef.current?.focus();
      if (firstError === 'transactionReference') transactionRef.current?.focus();
      if (firstError === 'receipt') receiptRef.current?.focus();
      return;
    }
    try {
      setStage('authorizing');
      const uploadToken = await uploadPaymentReceipt(api, file!, async (input, init) => {
        setStage('uploading');
        return fetch(input, init);
      });
      setStage('submitting');
      const result = await api.finalizePaymentReceiptAndSubmit({
        uploadToken,
        paymentMethod: method as PaymentMethod,
        transactionReference: transactionReference.trim(),
        ...(bankName.trim() ? { bankName: bankName.trim() } : {}),
        ...(paidAt ? { paidAt } : {}),
      });
      setSubmitted(result); setStage(null);
    } catch (error) {
      setStage(null);
      if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
        setSubmitError('This payment can no longer be submitted in its current state. Refresh for the latest status.');
      } else setSubmitError(error instanceof Error ? error.message : 'We could not submit your payment. Please try again.');
      queueMicrotask(() => submitErrorRef.current?.focus());
    }
  }

  if (submitted) return <PageContainer className="payment-page"><PageHeading eyebrow="Membership" title="Payment submitted successfully"
    description="Your payment is now ready for MyAIS verification." />
    <section className="payment-success"><span><CheckCircle2 /></span><StatusBadge tone="info">Awaiting verification</StatusBadge>
      <h2>Thank you. Your receipt was submitted securely.</h2><p>No further action is needed while the MyAIS team verifies your payment.</p>
      <dl><div><dt>Payment reference</dt><dd>{submitted.paymentReference || 'Not assigned'}</dd></div>
        <div><dt>Status</dt><dd>{statusLabel(submitted.status)}</dd></div>
        <div><dt>Submitted</dt><dd>{formattedDate(submitted.submittedAt)}</dd></div></dl>
      <Link className="button button-primary" href="/my-application/tracker">View application tracker</Link></section>
  </PageContainer>;

  const payment = current?.payment;
  const editable = current?.applicationStatus === 'APPROVED_PENDING_PAYMENT' &&
    (payment?.status === 'NOT_SUBMITTED' || payment?.status === 'REJECTED');
  const readOnly = payment?.status === 'SUBMITTED' || payment?.status === 'UNDER_VERIFICATION' ||
    payment?.status === 'VERIFIED';

  return <PageContainer className="payment-page">
    <PageHeading eyebrow="Membership" title={payment?.status === 'REJECTED' ? 'Resubmit membership payment' : 'Membership payment'}
      description="Review the approved fees and submit your payment receipt through private MyAIS storage." />
    {current === undefined && <div className="application-loading" role="status"><LoaderCircle className="spin" /> Loading payment details…</div>}
    {loadError && <div className="application-load-error" role="alert"><AlertCircle />We could not load your payment details.
      <button onClick={load}>Try again</button></div>}
    {!loadError && current !== undefined && (!current || !payment) && <section className="tracker-empty-state">
      <span><Landmark /></span><div><h2>No payment is currently due</h2><p>A payment record will appear after your application is approved for payment.</p></div>
      <Link className="button button-secondary" href="/my-application/tracker">Application tracker</Link></section>}
    {current && payment && readOnly && <PaymentReadOnly current={current} />}
    {current && payment && !editable && !readOnly && <section className="tracker-empty-state">
      <span><AlertCircle /></span><div><h2>Payment submission unavailable</h2>
        <p>The payment and application states do not currently allow a submission. Return to the tracker for the latest status.</p></div>
      <Link className="button button-secondary" href="/my-application/tracker">Application tracker</Link></section>}
    {current && payment && editable && <div className="payment-layout">
      <section className="payment-form-panel">
        {payment.status === 'REJECTED' && <div className="payment-rejection" role="status"><AlertCircle /><div>
          <strong>Payment needs resubmission</strong>
          {payment.rejectionReason && <p>{payment.rejectionReason}</p>}
          {payment.treasurerRemarks && payment.treasurerRemarks !== payment.rejectionReason && <p>{payment.treasurerRemarks}</p>}
          {!payment.rejectionReason && !payment.treasurerRemarks && <p>Please review your payment details and submit a replacement receipt.</p>}
        </div></div>}
        <header><span><ShieldCheck /></span><div><p>{current.applicationNumber || 'Approved application'}</p>
          <h2>Payment and receipt details</h2></div></header>
        <form onSubmit={submit} noValidate>
          <label className="form-field"><span>Payment method <strong>Required</strong></span>
            <select ref={methodRef} value={method} disabled={Boolean(stage)} aria-invalid={Boolean(errors.method)}
              onChange={event => { setMethod(event.target.value as PaymentMethod); setErrors(value => ({ ...value, method: undefined })); }}>
              <option value="">Choose a method</option>{paymentMethods.map(value => <option key={value} value={value}>{paymentMethodLabel(value)}</option>)}
            </select>{errors.method && <small className="field-error">{errors.method}</small>}</label>
          <label className="form-field"><span>Transaction reference <strong>Required</strong></span>
            <input ref={transactionRef} value={transactionReference} disabled={Boolean(stage)} aria-invalid={Boolean(errors.transactionReference)}
              onChange={event => { setTransactionReference(event.target.value); setErrors(value => ({ ...value, transactionReference: undefined })); }}
              placeholder="Enter the bank or transfer reference" />
            {errors.transactionReference && <small className="field-error">{errors.transactionReference}</small>}</label>
          <div className="payment-form-row"><label className="form-field"><span>Bank <small>Optional</small></span>
            <input value={bankName} disabled={Boolean(stage)} onChange={event => setBankName(event.target.value)} placeholder="Bank name" /></label>
            <label className="form-field"><span>Payment date <small>Optional</small></span>
              <input type="date" value={paidAt} disabled={Boolean(stage)} onChange={event => setPaidAt(event.target.value)} /></label></div>
          <div className="payment-receipt-field"><div><span>Payment receipt <strong>Required</strong></span>
            <p>PDF, JPEG or PNG · Maximum 5 MiB</p></div>
            <label className={`response-upload-control${stage ? ' is-disabled' : ''}`}>
              <input ref={receiptRef} type="file" accept={PAYMENT_RECEIPT_ACCEPT} onChange={chooseFile} disabled={Boolean(stage)} />
              <UploadCloud size={18} />{file ? 'Replace receipt' : 'Choose receipt'}</label>
            {file && <div className="response-selected-file"><FileText /><span><strong>{file.name}</strong>
              <small>{receiptTypeLabel(file)} · {Math.max(1, Math.round(file.size / 1024))} KB · Ready for private upload</small></span>
              <button type="button" disabled={Boolean(stage)} onClick={() => setFile(null)}>Remove</button></div>}
            {errors.receipt && <p className="upload-error" role="alert">{errors.receipt}</p>}
          </div>
          {submitError && <div ref={submitErrorRef} tabIndex={-1} className="submission-error" role="alert"><AlertCircle />
            <span>{submitError}</span>{submitError.includes('current state') && <button type="button" onClick={load}><RefreshCw /> Refresh</button>}</div>}
          <div className="payment-submit-note"><FileCheck2 />Submitting securely records your details and sends this payment for verification.</div>
          <div className="payment-page-actions"><Link href="/my-application/tracker"><ArrowLeft size={16} /> Back to tracker</Link>
            <Button type="submit" disabled={Boolean(stage)}>{stage ? <><LoaderCircle className="spin" />
              {stage === 'authorizing' ? 'Securing receipt…' : stage === 'uploading' ? 'Uploading receipt…' : 'Submitting payment…'}</> :
              payment.status === 'REJECTED' ? 'Resubmit payment' : 'Submit payment'}</Button></div>
          <p className="sr-only" aria-live="polite">{stage ? 'Payment submission in progress.' : ''}</p>
        </form>
      </section>
      <PaymentSummary current={current} />
    </div>}
  </PageContainer>;
}
