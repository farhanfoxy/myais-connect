'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, RefreshCw, Search, X } from 'lucide-react';
import { EventCard } from '@/components/events/event-card';
import { PageContainer, PageHeading } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import type { EventRecord } from '@/lib/api-client';
import { eventCategories } from '@/lib/events';
import { createMemberApiClient } from '@/lib/member-api';

export function MemberEvents() {
  const api = useMemo(() => createMemberApiClient(), []);
  const [events, setEvents] = useState<EventRecord[] | null>(null);
  const [query, setQuery] = useState({ search: '', category: 'ALL' });
  const [search, setSearch] = useState('');
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    setError(false); setEvents(null);
    return api.listEvents(query).then(setEvents).catch(() => { setError(true); setEvents([]); });
  }, [api, query]);
  useEffect(() => { let active = true; api.listEvents(query).then(value => { if (active) setEvents(value); })
    .catch(() => { if (active) { setError(true); setEvents([]); } }); return () => { active = false; }; }, [api, query]);
  function submit(event: FormEvent) { event.preventDefault(); setEvents(null); setQuery(value => ({ ...value, search: search.trim() })); }
  function clear() { setSearch(''); setEvents(null); setQuery({ search: '', category: 'ALL' }); }
  return <PageContainer className="events-page"><PageHeading eyebrow="MyAIS community" title="Events & programmes"
    description="Discover upcoming seminars, workshops, meetings and professional programmes." />
    <form className="events-filter-bar" role="search" onSubmit={submit}><label><Search /><span className="sr-only">Search events</span>
      <input placeholder="Search events" value={search} maxLength={200} onChange={event => setSearch(event.target.value)} /></label>
      <select aria-label="Event category" value={query.category} onChange={event => { setEvents(null);
        setQuery(value => ({ ...value, category: event.target.value })); }}><option value="ALL">All categories</option>
        {eventCategories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
      <Button type="submit">Search</Button>{(query.search || query.category !== 'ALL') && <Button variant="ghost" onClick={clear}><X />Clear</Button>}</form>
    {!events && !error && <div className="events-loading" role="status"><span /><span /><span /><p>Loading events…</p></div>}
    {error && <div className="application-load-error" role="alert"><AlertCircle />We could not load events.
      <button onClick={() => void load()}><RefreshCw />Try again</button></div>}
    {events?.length === 0 && !error && <section className="events-empty"><span><CalendarDays /></span><h2>No upcoming events yet</h2>
      <p>Published MyAIS events will appear here when they are scheduled.</p></section>}
    {events && events.length > 0 && <section className="event-grid" aria-label="Upcoming events">
      {events.map(event => <EventCard key={event.id} event={event} />)}</section>}
  </PageContainer>;
}
