'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck2, CalendarDays, CheckCircle2, MapPin } from 'lucide-react';
import { PageContainer, PageHeading } from '@/components/dashboard/dashboard-ui';
import type { EventRegistrationRecord } from '@/lib/api-client';
import { eventDateLabel, eventVenueLabel } from '@/lib/events';
import { createMemberApiClient } from '@/lib/member-api';

export function MyEvents() {
  const api = useMemo(() => createMemberApiClient(), []);
  const [items, setItems] = useState<EventRegistrationRecord[] | null>(null); const [scope, setScope] = useState<'ALL' | 'UPCOMING' | 'PAST'>('ALL');
  const [error, setError] = useState(false);
  useEffect(() => { let active = true; api.listOwnEventRegistrations(scope).then(value => { if (active) setItems(value); })
    .catch(() => { if (active) { setError(true); setItems([]); } }); return () => { active = false; }; }, [api, scope]);
  return <PageContainer className="my-events-page"><PageHeading eyebrow="My participation" title="My events"
    description="Your confirmed registrations, event tickets and attendance history." />
    <div className="my-events-tabs" role="group" aria-label="Event registration period">{(['ALL', 'UPCOMING', 'PAST'] as const).map(value =>
      <button key={value} className={scope === value ? 'is-active' : ''} onClick={() => { setError(false); setItems(null); setScope(value); }}>
        {value === 'ALL' ? 'All registrations' : value === 'UPCOMING' ? 'Upcoming' : 'Past'}</button>)}</div>
    {!items && <div className="events-loading" role="status"><span /><span /><p>Loading registrations…</p></div>}
    {error && <div className="application-load-error" role="alert">We could not load your event registrations.</div>}
    {items?.length === 0 && !error && <section className="events-empty"><CalendarDays /><h2>No registrations here</h2>
      <p>Explore published MyAIS events and register when a programme interests you.</p>
      <Link className="button button-primary" href="/events">Browse events</Link></section>}
    {items && items.length > 0 && <div className="my-events-list">{items.map(item => <article key={`${item.event.id}-${item.registeredAt}`}>
      <span className="my-event-icon">{item.status === 'ATTENDED' ? <CheckCircle2 /> : <CalendarCheck2 />}</span>
      <div><div className="my-event-title-row"><h2>{item.event.title}</h2><span className={`status-badge status-${item.status.toLowerCase()}`}>{item.status.replaceAll('_', ' ')}</span></div>
        <p><CalendarDays />{eventDateLabel(item.event)}<span>·</span><MapPin />{eventVenueLabel(item.event)}</p>
        {item.event.status === 'CANCELLED' && <small>{item.event.cancellationReason || 'This event was cancelled.'}</small>}</div>
      <Link href={`/events/${item.event.id}`}>{item.status === 'CANCELLED' ? 'View event' : 'View ticket'}</Link>
    </article>)}</div>}
  </PageContainer>;
}
