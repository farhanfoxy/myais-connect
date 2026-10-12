'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, Clock3, MapPin, Mic2, QrCode, UsersRound } from 'lucide-react';
import QRCode from 'qrcode';
import { PageContainer } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import type { EventRecord, EventRegistrationRecord } from '@/lib/api-client';
import { eventCategoryLabel, eventDateLabel, eventFeeLabel, eventVenueLabel } from '@/lib/events';
import { createMemberApiClient } from '@/lib/member-api';

export function EventDetail({ id }: Readonly<{ id: string }>) {
  const api = useMemo(() => createMemberApiClient(), []);
  const [event, setEvent] = useState<EventRecord | null | undefined>(undefined);
  const [registration, setRegistration] = useState<EventRegistrationRecord | null | undefined>(undefined);
  const [ticketImage, setTicketImage] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const load = useCallback(async () => { const [eventRecord, registrationRecord] = await Promise.all([
    api.getEvent(id), api.getOwnEventRegistration(id),
  ]); setEvent(eventRecord); setRegistration(registrationRecord); }, [api, id]);
  useEffect(() => { let active = true; Promise.all([api.getEvent(id), api.getOwnEventRegistration(id)])
    .then(([eventRecord, registrationRecord]) => { if (active) { setEvent(eventRecord); setRegistration(registrationRecord); } })
    .catch(() => { if (active) setEvent(null); }); return () => { active = false; }; }, [api, id]);
  useEffect(() => { let active = true; if (!registration?.ticketCode) { queueMicrotask(() => setTicketImage('')); return; }
    void QRCode.toDataURL(registration.ticketCode, { width: 240, margin: 2, errorCorrectionLevel: 'M',
      color: { dark: '#071d31', light: '#ffffff' } }).then(value => { if (active) setTicketImage(value); });
    return () => { active = false; }; }, [registration?.ticketCode]);
  async function register() { setBusy(true); setMessage(''); try { setRegistration(await api.registerForEvent(id));
      setMessage('Your event registration is confirmed.'); } catch { setMessage('Registration is unavailable, closed, full, or already exists.'); }
    finally { setBusy(false); } }
  async function cancel() { setBusy(true); setMessage(''); try { await api.cancelOwnEventRegistration(id); await load();
      setMessage('Your event registration has been cancelled.'); } catch { setMessage('This registration could not be cancelled.'); }
    finally { setBusy(false); } }
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
        <div className="event-registration-note"><strong>{registration?.status === 'REGISTERED' ? 'Registration confirmed' :
          registration?.status === 'ATTENDED' ? 'Attendance confirmed' : registration?.status === 'CANCELLED' ? 'Registration cancelled' :
          event.registrationAvailable ? 'Registration is open' : 'Registration is closed'}</strong>
          <p>{event.registrationDeadline ? `Registration deadline: ${event.registrationDeadline}.` : 'Managed securely through MyAIS Connect.'}</p>
          {!registration && event.registrationAvailable && <Button onClick={() => void register()} disabled={busy}>Register</Button>}
          {registration?.status === 'REGISTERED' && <Button variant="secondary" onClick={() => void cancel()} disabled={busy}>Cancel registration</Button>}
          {message && <span className="event-registration-message" role="status">{message}</span>}</div>
        {registration && registration.status !== 'CANCELLED' && <section className="event-ticket" aria-label="Event ticket">
          <header><span><QrCode /></span><div><small>MyAIS event ticket</small><h2>{event.title}</h2></div></header>
          {ticketImage && <Image src={ticketImage} width={216} height={216} unoptimized alt="Event check-in QR code" />}
          <div><CheckCircle2 /><p><strong>{registration.status === 'ATTENDED' ? 'Checked in' : 'Confirmed registration'}</strong>
            <span>{registration.status === 'ATTENDED' ? 'Your attendance has been recorded.' : 'Present this QR code at check-in.'}</span></p></div>
          <code>{registration.ticketCode}</code></section>}</aside></div>
  </PageContainer>;
}
