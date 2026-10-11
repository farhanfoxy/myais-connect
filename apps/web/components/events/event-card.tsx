import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import type { EventRecord } from '@/lib/api-client';
import { eventCategoryLabel, eventDateLabel, eventVenueLabel } from '@/lib/events';

export function EventCard({ event, compact = false }: Readonly<{ event: EventRecord; compact?: boolean }>) {
  return <article className={`event-card${compact ? ' event-card-compact' : ''}`}>
    <div className="event-card-media">{event.coverImage ? <Image src={event.coverImage} alt="" fill unoptimized sizes="(max-width: 680px) 100vw, 33vw" /> :
      <span aria-hidden="true"><CalendarDays /></span>}</div>
    <div className="event-card-body"><div className="event-card-meta"><span>{eventCategoryLabel(event.category)}</span>
      {event.limitedSeats && <span>Limited seats</span>}</div>
      <h3>{event.title}</h3>{event.summary && <p>{event.summary}</p>}
      <dl><div><dt><CalendarDays /></dt><dd>{eventDateLabel(event)} · {event.startTime}</dd></div>
        <div><dt><MapPin /></dt><dd>{eventVenueLabel(event)}</dd></div></dl>
      <Link href={`/events/${event.id}`}>View event <ArrowRight /></Link></div>
  </article>;
}
