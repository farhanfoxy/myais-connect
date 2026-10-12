'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Download, QrCode, Search, UsersRound } from 'lucide-react';
import { PageContainer, PageHeading } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import type { AdminEventAttendeePage } from '@/lib/api-client';
import { createMemberApiClient } from '@/lib/member-api';
import { humanizeEnum } from '@/lib/roles';

export function EventAttendees({ id }: Readonly<{ id: string }>) {
  const api = useMemo(() => createMemberApiClient(), []); const [data, setData] = useState<AdminEventAttendeePage | null>(null);
  const [query, setQuery] = useState({ search: '', status: 'ALL', page: '1', pageSize: '20' }); const [draft, setDraft] = useState('');
  const [ticket, setTicket] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setData(await api.listEventAttendees(id, query)); }, [api, id, query]);
  useEffect(() => { let active = true; api.listEventAttendees(id, query).then(value => { if (active) setData(value); })
    .catch(() => { if (active) setData(null); }); return () => { active = false; }; }, [api, id, query]);
  function search(event: FormEvent) { event.preventDefault(); setData(null); setQuery(value => ({ ...value, search: draft.trim(), page: '1' })); }
  async function qrCheckIn(event: FormEvent) { event.preventDefault(); if (!ticket.trim()) return; setBusy(true); setMessage('');
    try { const result = await api.checkInEventTicket(id, ticket.trim()); setMessage(result.message); setTicket(''); await load(); }
    catch { setMessage('Invalid ticket, cancelled registration, or check-in unavailable.'); } finally { setBusy(false); } }
  async function manual(registrationId: string) { setBusy(true); setMessage(''); try {
    const result = await api.manuallyCheckInEventRegistration(id, registrationId); setMessage(result.message); await load();
    } catch { setMessage('Manual check-in could not be completed.'); } finally { setBusy(false); } }
  async function exportFile(format: 'csv' | 'xlsx') { setBusy(true); setMessage('Preparing attendance export…'); try {
    const file = await api.downloadReport('event-attendance', { eventId: id, format }); const url = URL.createObjectURL(file.blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage('Attendance export downloaded.'); } catch { setMessage('Attendance export could not be generated.'); } finally { setBusy(false); } }
  return <PageContainer className="event-attendees-page"><Link className="event-back-link" href={`/admin/events/${id}`}><ArrowLeft />Event details</Link>
    <PageHeading eyebrow={data?.event.eventNumber || 'Event operations'} title={data?.event.title || 'Event attendees'}
      description="Registration capacity, attendance and secure check-in management." />
    {data && <div className="attendee-metrics"><article><UsersRound /><div><strong>{data.registeredCount}</strong><span>Registered</span></div></article>
      <article><CheckCircle2 /><div><strong>{data.attendanceCount}</strong><span>Checked in</span></div></article>
      <article><span>CAP</span><div><strong>{data.event.limitedSeats ? data.event.capacity ?? '—' : 'Open'}</strong><span>Capacity</span></div></article></div>}
    <section className="check-in-panel"><div><span><QrCode /></span><div><h2>QR ticket check-in</h2>
      <p>Use a connected scanner or paste the opaque ticket code. Camera access is not required.</p></div></div>
      <form onSubmit={qrCheckIn}><input value={ticket} onChange={event => setTicket(event.target.value)}
        placeholder="Scan or enter ticket code" autoComplete="off" /><Button type="submit" disabled={busy || !ticket.trim()}>Check in</Button></form>
      {message && <p role="status">{message}</p>}</section>
    <div className="attendee-toolbar"><form onSubmit={search}><label><Search /><input value={draft} onChange={event => setDraft(event.target.value)}
      placeholder="Search attendee or member number" /></label><Button type="submit">Search</Button></form>
      <select aria-label="Attendance status" value={query.status} onChange={event => { setData(null);
        setQuery(value => ({ ...value, status: event.target.value, page: '1' })); }}><option value="ALL">All statuses</option>
        {['REGISTERED', 'ATTENDED', 'CANCELLED', 'NO_SHOW'].map(value => <option key={value}>{value}</option>)}</select>
      <div><Button variant="secondary" onClick={() => void exportFile('csv')} disabled={busy}><Download />CSV</Button>
        <Button variant="secondary" onClick={() => void exportFile('xlsx')} disabled={busy}><Download />XLSX</Button></div></div>
    {!data && <div className="events-loading" role="status"><span /><p>Loading attendees…</p></div>}
    {data?.items.length === 0 && <section className="events-empty"><UsersRound /><h2>No registrations found</h2><p>Registered attendees will appear here.</p></section>}
    {data && data.items.length > 0 && <div className="responsive-table attendee-table"><table><thead><tr><th>Attendee</th><th>Member number</th>
      <th>Membership</th><th>Registered</th><th>Status</th><th>Checked in</th><th /></tr></thead><tbody>{data.items.map(item => <tr key={item.id}>
        <td data-label="Attendee"><strong>{item.name || 'Name unavailable'}</strong></td><td data-label="Member number">{item.membershipNumber || '—'}</td>
        <td data-label="Membership">{item.membershipType || '—'}</td><td data-label="Registered">{item.registeredAt ? new Date(item.registeredAt).toLocaleString('en-MY') : '—'}</td>
        <td data-label="Status"><span className={`status-badge status-${item.status.toLowerCase()}`}>{humanizeEnum(item.status)}</span></td>
        <td data-label="Checked in">{item.checkedInAt ? new Date(item.checkedInAt).toLocaleString('en-MY') : '—'}</td><td>
          {item.status === 'REGISTERED' && <Button variant="secondary" disabled={busy} onClick={() => void manual(item.id)}>Check in</Button>}</td></tr>)}</tbody></table></div>}
  </PageContainer>;
}
