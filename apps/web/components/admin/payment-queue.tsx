'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, ChevronLeft, ChevronRight, CreditCard, RefreshCw, Search, X } from 'lucide-react';
import { PageContainer, PageHeading, StatusBadge } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import type { ReviewerPaymentQueue } from '@/lib/api-client';
import { createAdminApiClient } from '@/lib/admin-api';
import { paymentMethodLabel, statusLabel, statusTone } from '@/lib/member-status';

const statuses = ['ALL', 'NOT_SUBMITTED', 'SUBMITTED', 'UNDER_VERIFICATION', 'VERIFIED', 'REJECTED'] as const;

export function formatMoney(amount: string | null, currency: string | null): string {
  if (amount === null) return 'Not available';
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return `${currency || ''} ${amount}`.trim();
  if (currency === 'MYR') return `RM ${numeric.toFixed(2)}`;
  try {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency: currency || 'MYR' }).format(numeric);
  } catch {
    return `${currency || ''} ${numeric.toFixed(2)}`.trim();
  }
}

function dateLabel(value: string | null): string {
  if (!value) return 'Not submitted';
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium' }).format(new Date(value));
}

function typeLabel(value: { code: string; name: string | null } | null): string {
  return value?.name || (value?.code ? statusLabel(value.code) : 'Not available');
}

export function PaymentQueue() {
  const api = useMemo(() => createAdminApiClient(), []);
  const [query, setQuery] = useState({ page: 1, pageSize: 15, search: '', status: 'ALL' });
  const [searchDraft, setSearchDraft] = useState('');
  const [result, setResult] = useState<ReviewerPaymentQueue | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setResult(null); setError(false);
    return api.listReviewerPayments(query).then(setResult).catch(() => { setError(true); setResult(null); });
  }, [api, query]);

  useEffect(() => {
    let active = true;
    api.listReviewerPayments(query).then(value => { if (active) setResult(value); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [api, query]);

  function beginQuery(update: (value: typeof query) => typeof query) {
    setResult(null); setError(false); setQuery(update);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    beginQuery(value => ({ ...value, page: 1, search: searchDraft.trim() }));
  }

  function resetFilters() {
    setSearchDraft(''); beginQuery(value => ({ ...value, page: 1, search: '', status: 'ALL' }));
  }

  return <PageContainer className="admin-payments-page">
    <PageHeading eyebrow="Payment verification" title="Submitted payments"
      description="Review submitted payment evidence and complete the authorized membership activation workflow." />
    <section className="review-queue-panel payment-queue-panel" aria-labelledby="payment-queue-heading">
      <header className="review-queue-header"><div><p>Verification queue</p><h2 id="payment-queue-heading">Payments</h2></div>
        {result && <span>{result.total} {result.total === 1 ? 'record' : 'records'}</span>}</header>
      <form className="review-queue-filters" onSubmit={submitSearch} role="search">
        <label className="review-search-field"><span className="sr-only">Search payments</span><Search aria-hidden="true" />
          <input value={searchDraft} onChange={event => setSearchDraft(event.target.value)}
            placeholder="Search applicant, payment or application reference" maxLength={200} /></label>
        <label className="review-status-filter"><span>Status</span><select value={query.status}
          onChange={event => beginQuery(value => ({ ...value, page: 1, status: event.target.value }))}>
          {statuses.map(status => <option key={status} value={status}>{status === 'ALL' ? 'All statuses' : statusLabel(status)}</option>)}
        </select></label>
        <Button type="submit">Search</Button>
        {(query.search || query.status !== 'ALL') && <Button variant="ghost" onClick={resetFilters}><X size={16} />Reset</Button>}
      </form>
      {!result && !error && <div className="review-loading" role="status"><span className="review-skeleton" /><span className="review-skeleton" />
        <span className="review-skeleton" /><p>Loading payments…</p></div>}
      {error && <div className="application-load-error" role="alert"><AlertCircle />We could not load the payment queue.
        <button onClick={() => void load()}><RefreshCw size={15} />Try again</button></div>}
      {result?.items.length === 0 && <div className="review-empty"><CreditCard /><h3>No payments found</h3>
        <p>Try another search or status filter.</p>{(query.search || query.status !== 'ALL') && <Button variant="secondary"
          onClick={resetFilters}>Clear filters</Button>}</div>}
      {result && result.items.length > 0 && <>
        <div className="review-table-wrap"><table className="review-table payment-review-table"><thead><tr><th>Applicant</th>
          <th>Payment reference</th><th>Application</th><th>Membership</th><th>Amount</th><th>Status</th><th>Submitted</th>
          <th><span className="sr-only">Action</span></th></tr></thead><tbody>{result.items.map(item => <tr key={item.id}>
          <td><strong>{item.applicantName}</strong><span>{item.applicantEmail}</span></td><td>{item.paymentReference || 'Not assigned'}</td>
          <td>{item.applicationNumber || 'Not available'}</td><td>{typeLabel(item.membershipType)}</td>
          <td><strong className="payment-amount">{formatMoney(item.totalAmount, item.currency)}</strong>
            <span>{paymentMethodLabel(item.paymentMethod)}</span></td>
          <td><StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status)}</StatusBadge></td>
          <td>{dateLabel(item.submittedAt || item.createdAt)}</td><td><Link className="review-row-action"
            href={`/admin/payments/${item.id}`} aria-label={`View ${item.paymentReference || item.applicantName}`}>View <ArrowRight size={15} /></Link></td>
        </tr>)}</tbody></table></div>
        <ul className="review-card-list payment-review-card-list" aria-label="Payments">{result.items.map(item => <li key={item.id}>
          <header><div><strong>{item.applicantName}</strong><span>{item.applicantEmail}</span></div>
            <StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status)}</StatusBadge></header>
          <strong className="payment-card-amount">{formatMoney(item.totalAmount, item.currency)}</strong>
          <dl><div><dt>Payment reference</dt><dd>{item.paymentReference || 'Not assigned'}</dd></div>
            <div><dt>Application</dt><dd>{item.applicationNumber || 'Not available'}</dd></div>
            <div><dt>Membership</dt><dd>{typeLabel(item.membershipType)}</dd></div>
            <div><dt>Submitted</dt><dd>{dateLabel(item.submittedAt || item.createdAt)}</dd></div></dl>
          <Link className="button button-secondary" href={`/admin/payments/${item.id}`}>View payment <ArrowRight size={16} /></Link>
        </li>)}</ul>
        <footer className="review-pagination"><span>Page {result.page} of {Math.max(result.totalPages, 1)}</span><div>
          <Button variant="secondary" disabled={result.page <= 1}
            onClick={() => beginQuery(value => ({ ...value, page: value.page - 1 }))}><ChevronLeft size={16} />Previous</Button>
          <Button variant="secondary" disabled={result.page >= result.totalPages}
            onClick={() => beginQuery(value => ({ ...value, page: value.page + 1 }))}>Next<ChevronRight size={16} /></Button>
        </div></footer>
      </>}
    </section>
  </PageContainer>;
}
