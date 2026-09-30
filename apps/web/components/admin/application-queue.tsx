'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, ChevronLeft, ChevronRight, FileSearch, RefreshCw, Search, X } from 'lucide-react';
import { PageContainer, PageHeading, StatusBadge } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import type { ReviewerApplicationQueue } from '@/lib/api-client';
import { createAdminApiClient } from '@/lib/admin-api';
import { statusLabel, statusTone } from '@/lib/member-status';

const statuses = [
  'ALL', 'SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFORMATION_REQUIRED', 'RECOMMENDED_FOR_APPROVAL',
  'APPROVED_PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAYMENT_UNDER_VERIFICATION', 'ACTIVE', 'REJECTED',
] as const;

function dateLabel(value: string | null): string {
  if (!value) return 'Not submitted';
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium' }).format(new Date(value));
}

function typeLabel(value: { code: string; name: string | null } | null): string {
  return value?.name || (value?.code ? statusLabel(value.code) : 'Not available');
}

export function ApplicationQueue() {
  const api = useMemo(() => createAdminApiClient(), []);
  const [query, setQuery] = useState({ page: 1, pageSize: 15, search: '', status: 'ALL' });
  const [searchDraft, setSearchDraft] = useState('');
  const [result, setResult] = useState<ReviewerApplicationQueue | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setResult(null); setError(false);
    return api.listReviewerApplications(query).then(setResult).catch(() => { setError(true); setResult(null); });
  }, [api, query]);

  useEffect(() => {
    let active = true;
    api.listReviewerApplications(query)
      .then(value => { if (active) setResult(value); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [api, query]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setResult(null); setError(false);
    setQuery(value => ({ ...value, page: 1, search: searchDraft.trim() }));
  }

  function resetFilters() {
    setSearchDraft(''); setResult(null); setError(false);
    setQuery(value => ({ ...value, page: 1, search: '', status: 'ALL' }));
  }

  return <PageContainer className="admin-applications-page">
    <PageHeading eyebrow="Application review" title="Membership applications"
      description="Search, assess and progress submitted applications through the approved review workflow." />
    <section className="review-queue-panel" aria-labelledby="application-queue-heading">
      <header className="review-queue-header"><div><p>Reviewer queue</p><h2 id="application-queue-heading">Applications</h2></div>
        {result && <span>{result.total} {result.total === 1 ? 'record' : 'records'}</span>}</header>
      <form className="review-queue-filters" onSubmit={submitSearch} role="search">
        <label className="review-search-field"><span className="sr-only">Search applications</span><Search aria-hidden="true" />
          <input value={searchDraft} onChange={event => setSearchDraft(event.target.value)}
            placeholder="Search applicant, email or reference" maxLength={200} /></label>
        <label className="review-status-filter"><span>Status</span><select value={query.status}
          onChange={event => { setResult(null); setError(false);
            setQuery(value => ({ ...value, page: 1, status: event.target.value })); }}>
          {statuses.map(status => <option key={status} value={status}>{status === 'ALL' ? 'All statuses' : statusLabel(status)}</option>)}
        </select></label>
        <Button type="submit">Search</Button>
        {(query.search || query.status !== 'ALL') && <Button variant="ghost" onClick={resetFilters}><X size={16} />Reset</Button>}
      </form>

      {!result && !error && <div className="review-loading" role="status"><span className="review-skeleton" /><span className="review-skeleton" />
        <span className="review-skeleton" /><p>Loading applications…</p></div>}
      {error && <div className="application-load-error" role="alert"><AlertCircle />We could not load the application queue.
        <button onClick={() => void load()}><RefreshCw size={15} />Try again</button></div>}
      {result?.items.length === 0 && <div className="review-empty"><FileSearch /><h3>No applications found</h3>
        <p>Try another search or status filter.</p>{(query.search || query.status !== 'ALL') && <Button variant="secondary"
          onClick={resetFilters}>Clear filters</Button>}</div>}
      {result && result.items.length > 0 && <>
        <div className="review-table-wrap"><table className="review-table"><thead><tr><th>Applicant</th><th>Reference</th>
          <th>Requested</th><th>Recommended</th><th>Status</th><th>Submitted</th><th><span className="sr-only">Action</span></th>
        </tr></thead><tbody>{result.items.map(item => <tr key={item.id}><td><strong>{item.applicantName}</strong><span>{item.applicantEmail}</span></td>
          <td>{item.applicationNumber || 'Draft'}</td><td>{typeLabel(item.requestedMembershipType)}</td>
          <td>{typeLabel(item.recommendedMembershipType)}</td><td><StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status)}</StatusBadge></td>
          <td>{dateLabel(item.submittedAt || item.createdAt)}</td><td><Link className="review-row-action" href={`/admin/applications/${item.id}`}
            aria-label={`Review ${item.applicationNumber || item.applicantName}`}>Review <ArrowRight size={15} /></Link></td></tr>)}</tbody></table></div>
        <ul className="review-card-list" aria-label="Applications">{result.items.map(item => <li key={item.id}>
          <header><div><strong>{item.applicantName}</strong><span>{item.applicantEmail}</span></div>
            <StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status)}</StatusBadge></header>
          <dl><div><dt>Reference</dt><dd>{item.applicationNumber || 'Draft'}</dd></div>
            <div><dt>Requested</dt><dd>{typeLabel(item.requestedMembershipType)}</dd></div>
            <div><dt>Recommended</dt><dd>{typeLabel(item.recommendedMembershipType)}</dd></div>
            <div><dt>Submitted</dt><dd>{dateLabel(item.submittedAt || item.createdAt)}</dd></div></dl>
          <Link className="button button-secondary" href={`/admin/applications/${item.id}`}>Review application <ArrowRight size={16} /></Link>
        </li>)}</ul>
        <footer className="review-pagination"><span>Page {result.page} of {Math.max(result.totalPages, 1)}</span><div>
          <Button variant="secondary" disabled={result.page <= 1}
            onClick={() => { setResult(null); setError(false);
              setQuery(value => ({ ...value, page: value.page - 1 })); }}><ChevronLeft size={16} />Previous</Button>
          <Button variant="secondary" disabled={result.page >= result.totalPages}
            onClick={() => { setResult(null); setError(false);
              setQuery(value => ({ ...value, page: value.page + 1 })); }}>Next<ChevronRight size={16} /></Button>
        </div></footer>
      </>}
    </section>
  </PageContainer>;
}
