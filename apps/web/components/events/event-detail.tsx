'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle, ArrowLeft, CalendarDays, Clock3, MapPin, Mic2, UsersRound } from 'lucide-react';
import { PageContainer } from '@/components/dashboard/dashboard-ui';
import type { EventRecord } from '@/lib/api-client';
import { eventCategoryLabel, eventDateLabel, eventFeeLabel, eventVenueLabel } from '@/lib/events';
import { createMemberApiClient } from '@/lib/member-api';

export function EventDetail({ id }: Readonly<{ id: string }>) {
  const api = useMemo(() => createMemberApiClient(), []);
  const [event, setEvent] = useState<EventRecord | null | undefined>(undefined);
  useEffect(() => { let active = true; api.getEvent(id).then(value => { if (active) setEvent(value); })
    .catch(() => { if (active) setEvent(null); }); return () => { active = false; }; }, [api, id]);
  if (event === undefined) return <PageContainer className="event-detail-page"><div className="events-loading" role="status"><span /><p>Loading event…</p></div></PageContainer>;
  if (!event) return <PageContainer className="event-detail-page"><section className="events-empty"><AlertCircle /><h1>Event not found</h1>
    <p>This event is unavailable or is not currently published.</p><Link className="button button-secondary" href="/events">Back to events</Link></section></PageContainer>;
  return <PageContainer className="event-detail-page"><Link className="event-back-link" href="/events"><ArrowLeft />All events</Link>
    <section className="event-detail-hero"><div>{event.coverImage ? <Image src={event.coverImage} alt="" fill unoptimized sizes="(max-width: 680px) 100vw, 40vw" /> : <CalendarDays />}</div>
      <header><span>{eventCategoryLabel(event.category)}</span><h1>{event.title}</h1>{event.summary && <p>{event.summary}</p>}</header></section>
    <div className="event-detail-layout"><main><section className="event-detail-copy"><h2>About this event</h2>
      <p>{event.description}</p></section>{(event.speakerName || event.speakerTitle) && <section className="event-speaker"><Mic2 />
        <div><span>Speaker</span><h2>{event.speakerName || 'Speaker to be confirmed'}</h2><p>{event.speakerTitle}</p></div></section>}</main>
      <aside className="event-facts"><h2>Event details</h2><dl><div><dt><CalendarDays />Date</dt><dd>{eventDateLabel(event)}</dd></div>
        <div><dt><Clock3 />Time</dt><dd>{event.startTime}{event.endTime ? ` – ${event.endTime}` : ''} · {event.timezone}</dd></div>
        <div><dt><MapPin />Venue</dt><dd>{eventVenueLabel(event)}{event.physicalAddress ? ` · ${event.physicalAddress}` : ''}</dd></div>
        <div><dt><UsersRound />Capacity</dt><dd>{event.capacity === null ? 'Not specified' : `${event.capacity} seats`}</dd></div></dl>
        <div className="event-fees"><span>Member fee</span><strong>{eventFeeLabel(event.memberFee, event.currency)}</strong></div>
        <div className="event-registration-note"><strong>{event.registrationAvailable ? 'Registration information available' : 'Registration is not open in MyAIS'}</strong>
          <p>Online event registration is not available in this release.{event.registrationDeadline ? ` Deadline: ${event.registrationDeadline}.` : ''}</p></div></aside></div>
  </PageContainer>;
}
