'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, Search, X } from 'lucide-react';
import { PageContainer, PageHeading, StatusBadge } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import type { AdminEventQueue } from '@/lib/api-client';
import { createAdminApiClient } from '@/lib/admin-api';
import { eventCategories, eventCategoryLabel, eventDateLabel, eventStatusTone, eventVenueLabel } from '@/lib/events';
import { statusLabel } from '@/lib/member-status';

const statuses = ['ALL', 'DRAFT', 'PUBLISHED', 'REGISTRATION_CLOSED', 'CANCELLED', 'COMPLETED', 'ARCHIVED'];

export function AdminEventList() {
  const api = useMemo(() => createAdminApiClient(), []);
  const [query, setQuery] = useState({ page: 1, pageSize: 15, search: '', category: 'ALL', status: 'ALL' });
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState<AdminEventQueue | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => { setResult(null); setError(false); return api.listAdminEvents(query).then(setResult)
    .catch(() => { setError(true); setResult(null); }); }, [api, query]);
  useEffect(() => { let active = true; api.listAdminEvents(query).then(value => { if (active) setResult(value); })
    .catch(() => { if (active) setError(true); }); return () => { active = false; }; }, [api, query]);
  function change(values: Partial<typeof query>) { setResult(null); setError(false); setQuery(current => ({ ...current, ...values, page: 1 })); }
  function search(event: FormEvent) { event.preventDefault(); change({ search: draft.trim() }); }
  function reset() { setDraft(''); change({ search: '', category: 'ALL', status: 'ALL' }); }
  return <PageContainer className="admin-events-page"><PageHeading eyebrow="Event management" title="Events"
    description="Create, publish and manage source-backed MyAIS event information." />
    <div className="admin-events-toolbar"><Link className="button button-primary" href="/admin/events/new"><Plus />Create event</Link></div>
    <section className="review-queue-panel" aria-labelledby="admin-events-heading"><header className="review-queue-header"><div><p>Programme workspace</p>
      <h2 id="admin-events-heading">All events</h2></div>{result && <span>{result.total} {result.total === 1 ? 'event' : 'events'}</span>}</header>
      <form className="event-admin-filters" role="search" onSubmit={search}><label><Search /><span className="sr-only">Search events</span>
        <input value={draft} maxLength={200} placeholder="Search title or event number" onChange={event => setDraft(event.target.value)} /></label>
        <select aria-label="Category" value={query.category} onChange={event => change({ category: event.target.value })}><option value="ALL">All categories</option>
          {eventCategories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <select aria-label="Status" value={query.status} onChange={event => change({ status: event.target.value })}>{statuses.map(status =>
          <option key={status} value={status}>{status === 'ALL' ? 'All statuses' : statusLabel(status)}</option>)}</select>
        <Button type="submit">Search</Button>{(query.search || query.category !== 'ALL' || query.status !== 'ALL') &&
          <Button variant="ghost" onClick={reset}><X />Reset</Button>}</form>
      {!result && !error && <div className="review-loading" role="status"><span className="review-skeleton" /><span className="review-skeleton" /><p>Loading events…</p></div>}
      {error && <div className="application-load-error" role="alert"><AlertCircle />We could not load events.<button onClick={() => void load()}><RefreshCw />Try again</button></div>}
      {result?.items.length === 0 && <div className="review-empty"><CalendarDays /><h3>No events found</h3><p>Create an event or adjust the filters.</p></div>}
      {result && result.items.length > 0 && <><div className="review-table-wrap"><table className="review-table event-admin-table"><thead><tr>
        <th>Event</th><th>Date</th><th>Venue</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>
        {result.items.map(event => <tr key={event.id}><td><strong>{event.title}</strong><span>{event.eventNumber || eventCategoryLabel(event.category)}</span></td>
          <td>{eventDateLabel(event)}<span>{event.startTime}</span></td><td>{eventVenueLabel(event)}</td><td><StatusBadge tone={eventStatusTone(event.status)}>{statusLabel(event.status)}</StatusBadge></td>
          <td><Link className="review-row-action" href={`/admin/events/${event.id}`}>Manage <ArrowRight /></Link></td></tr>)}</tbody></table></div>
        <ul className="review-card-list event-admin-cards" aria-label="Events">{result.items.map(event => <li key={event.id}><header><div><strong>{event.title}</strong>
          <span>{event.eventNumber || eventCategoryLabel(event.category)}</span></div><StatusBadge tone={eventStatusTone(event.status)}>{statusLabel(event.status)}</StatusBadge></header>
          <dl><div><dt>Date</dt><dd>{eventDateLabel(event)} · {event.startTime}</dd></div><div><dt>Venue</dt><dd>{eventVenueLabel(event)}</dd></div></dl>
          <Link className="button button-secondary" href={`/admin/events/${event.id}`}>Manage event <ArrowRight /></Link></li>)}</ul>
        <footer className="review-pagination"><span>Page {result.page} of {Math.max(result.totalPages, 1)}</span><div>
          <Button variant="secondary" disabled={result.page <= 1} onClick={() => { setResult(null); setQuery(value => ({ ...value, page: value.page - 1 })); }}><ChevronLeft />Previous</Button>
          <Button variant="secondary" disabled={result.page >= result.totalPages} onClick={() => { setResult(null); setQuery(value => ({ ...value, page: value.page + 1 })); }}>Next<ChevronRight /></Button>
        </div></footer></>}
    </section></PageContainer>;
}
