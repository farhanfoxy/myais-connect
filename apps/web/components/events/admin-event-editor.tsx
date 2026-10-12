'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, BadgeCheck, Ban, Eye, Save, Send, UsersRound } from 'lucide-react';
import { PageContainer, PageHeading, StatusBadge } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import type { AdminEventRecord, EventCategory, EventInput } from '@/lib/api-client';
import { createAdminApiClient } from '@/lib/admin-api';
import { prepareEventInput, type EventFieldErrors } from '@/lib/event-form';
import { eventCategories, eventStatusTone } from '@/lib/events';
import { statusLabel } from '@/lib/member-status';

const emptyEvent: EventInput = { title: '', category: 'SEMINARS_AND_WEBINARS', description: '', venueType: 'ONLINE',
  startDate: '', startTime: '', limitedSeats: false, memberFee: 0, nonMemberFee: 0, currency: 'MYR',
  targetAudience: 'MEMBERS_AND_NON_MEMBERS', onlineMeetingUrl: '' };

function FieldError({ errors, name }: Readonly<{ errors: EventFieldErrors; name: string }>) {
  return errors[name] ? <small className="event-field-error" id={`${name}-error`}>{errors[name]}</small> : null;
}

function inputFrom(event: AdminEventRecord): EventInput {
  return { title: event.title, category: event.category, summary: event.summary, description: event.description,
    coverImage: event.coverImage, speakerName: event.speakerName, speakerTitle: event.speakerTitle, eventType: event.eventType,
    venueType: event.venueType, venueName: event.venueName, physicalAddress: event.physicalAddress,
    onlineMeetingUrl: event.onlineMeetingUrl, startDate: event.startDate, startTime: event.startTime, endDate: event.endDate,
    endTime: event.endTime, registrationStart: event.registrationStart, registrationDeadline: event.registrationDeadline,
    capacity: event.capacity, limitedSeats: Boolean(event.limitedSeats), memberFee: Number(event.memberFee ?? 0),
    nonMemberFee: Number(event.nonMemberFee ?? 0), currency: event.currency || 'MYR',
    paymentInstructions: event.paymentInstructions, registrationUrl: event.registrationUrl,
    targetAudience: event.targetAudience || 'MEMBERS_AND_NON_MEMBERS' };
}

export function AdminEventEditor({ id }: Readonly<{ id?: string }>) {
  const api = useMemo(() => createAdminApiClient(), []);
  const router = useRouter();
  const [form, setForm] = useState<EventInput>(emptyEvent);
  const [record, setRecord] = useState<AdminEventRecord | null | undefined>(id ? undefined : null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(() => {
    if (!id || typeof window === 'undefined') return '';
    const key = `myais:event-created:${id}`;
    try {
      if (window.sessionStorage.getItem(key)) { window.sessionStorage.removeItem(key); return 'Event created successfully.'; }
    } catch { /* Transient feedback is optional when browser storage is unavailable. */ }
    return '';
  });
  const [error, setError] = useState('');
  const [cancelReason, setCancelReason] = useState('Cancelled by administrator');
  const [fieldErrors, setFieldErrors] = useState<EventFieldErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const saveInProgress = useRef(false);
  useEffect(() => { if (!id) return; let active = true; api.getAdminEvent(id).then(value => { if (active) { setRecord(value); setForm(inputFrom(value)); } })
    .catch(() => { if (active) setRecord(null); }); return () => { active = false; }; }, [api, id]);
  function set<K extends keyof EventInput>(key: K, value: EventInput[K]) {
    setForm(current => ({ ...current, [key]: value }));
    setMessage('');
    setFieldErrors(current => {
      if (!current[String(key)]) return current;
      const next = { ...current };
      delete next[String(key)];
      return next;
    });
  }
  function validationProps(name: string) {
    return { name, 'aria-invalid': Boolean(fieldErrors[name]),
      'aria-describedby': fieldErrors[name] ? `${name}-error` : undefined };
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saveInProgress.current) return;
    setError(''); setMessage('');
    const prepared = prepareEventInput(form);
    if (!prepared.success) {
      setFieldErrors(prepared.errors);
      setError('We could not save the event. Check the highlighted fields.');
      const firstField = Object.keys(prepared.errors)[0];
      queueMicrotask(() => formRef.current?.querySelector<HTMLElement>(`[name="${firstField}"]`)?.focus());
      return;
    }
    setFieldErrors({}); saveInProgress.current = true; setSaving(true);
    try {
      const value = id ? await api.updateEvent(id, prepared.data) : await api.createEvent(prepared.data);
      setRecord(value); setForm(inputFrom(value)); setMessage(id ? 'Event updated successfully.' : 'Event created successfully.');
      if (!id) {
        try { window.sessionStorage.setItem(`myais:event-created:${value.id}`, '1'); } catch { /* Message remains until navigation. */ }
        router.replace(`/admin/events/${value.id}`);
      }
    } catch { setError('We could not save the event. Check the highlighted fields.'); }
    finally { saveInProgress.current = false; setSaving(false); }
  }
  async function transition(action: 'publish' | 'cancel') {
    if (!id) return; setSaving(true); setError(''); setMessage('');
    try { const value = action === 'publish' ? await api.publishEvent(id) : await api.cancelEvent(id, cancelReason);
      setRecord(value); setMessage(action === 'publish' ? 'Event published.' : 'Event cancelled.'); }
    catch { setError(`We could not ${action} this event in its current state.`); }
    finally { setSaving(false); }
  }
  if (id && record === undefined) return <PageContainer className="admin-event-editor"><div className="events-loading" role="status"><span /><p>Loading event…</p></div></PageContainer>;
  if (id && record === null) return <PageContainer className="admin-event-editor"><section className="events-empty"><AlertCircle /><h1>Event not found</h1>
    <Link className="button button-secondary" href="/admin/events">Back to events</Link></section></PageContainer>;
  return <PageContainer className="admin-event-editor"><Link className="event-back-link" href="/admin/events"><ArrowLeft />Event management</Link>
    <PageHeading eyebrow={id ? record?.eventNumber || 'Event management' : 'Event management'} title={id ? 'Edit event' : 'Create event'}
      description="Maintain the source-backed event details used by the member experience." />
    {record && <div className="event-editor-status"><StatusBadge tone={eventStatusTone(record.status)}>{statusLabel(record.status)}</StatusBadge>
      <Link href={`/admin/events/${record.id}/registrations`}><UsersRound />Attendees</Link>
      {record.status === 'PUBLISHED' && <Link href={`/events/${record.id}`}><Eye />Member preview</Link>}</div>}
    <form ref={formRef} className="event-form" onSubmit={save} noValidate><fieldset disabled={saving}><section><header><span>01</span><div><h2>Event basics</h2><p>Title, category and member-facing information.</p></div></header>
      <div className="event-form-grid"><label className="event-field event-field-wide"><span>Event title *</span><input {...validationProps('title')} required maxLength={200} value={form.title} onChange={e => set('title', e.target.value)} /><FieldError errors={fieldErrors} name="title" /></label>
        <label className="event-field"><span>Category *</span><select {...validationProps('category')} value={form.category} onChange={e => set('category', e.target.value as EventCategory)}>{eventCategories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><FieldError errors={fieldErrors} name="category" /></label>
        <label className="event-field"><span>Event type</span><input {...validationProps('eventType')} value={form.eventType || ''} onChange={e => set('eventType', e.target.value)} /><FieldError errors={fieldErrors} name="eventType" /></label>
        <label className="event-field event-field-wide"><span>Summary</span><input {...validationProps('summary')} maxLength={500} value={form.summary || ''} onChange={e => set('summary', e.target.value)} /><FieldError errors={fieldErrors} name="summary" /></label>
        <label className="event-field event-field-wide"><span>Description *</span><textarea {...validationProps('description')} required rows={6} value={form.description} onChange={e => set('description', e.target.value)} /><FieldError errors={fieldErrors} name="description" /></label>
        <label className="event-field event-field-wide"><span>Cover image URL</span><input {...validationProps('coverImage')} type="url" value={form.coverImage || ''} onChange={e => set('coverImage', e.target.value)} placeholder="https://" /><FieldError errors={fieldErrors} name="coverImage" /></label>
        <label className="event-field"><span>Speaker name</span><input {...validationProps('speakerName')} value={form.speakerName || ''} onChange={e => set('speakerName', e.target.value)} /><FieldError errors={fieldErrors} name="speakerName" /></label>
        <label className="event-field"><span>Speaker title</span><input {...validationProps('speakerTitle')} value={form.speakerTitle || ''} onChange={e => set('speakerTitle', e.target.value)} /><FieldError errors={fieldErrors} name="speakerTitle" /></label></div></section>
      <section><header><span>02</span><div><h2>Schedule & venue</h2><p>Dates use the MyAIS Malaysia business timezone.</p></div></header><div className="event-form-grid">
        <label className="event-field"><span>Start date *</span><input {...validationProps('startDate')} required type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} /><FieldError errors={fieldErrors} name="startDate" /></label>
        <label className="event-field"><span>Start time *</span><input {...validationProps('startTime')} required type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)} /><FieldError errors={fieldErrors} name="startTime" /></label>
        <label className="event-field"><span>End date</span><input {...validationProps('endDate')} type="date" value={form.endDate || ''} onChange={e => set('endDate', e.target.value)} /><FieldError errors={fieldErrors} name="endDate" /></label>
        <label className="event-field"><span>End time</span><input {...validationProps('endTime')} type="time" value={form.endTime || ''} onChange={e => set('endTime', e.target.value)} /><FieldError errors={fieldErrors} name="endTime" /></label>
        <label className="event-field"><span>Venue type *</span><select {...validationProps('venueType')} value={form.venueType} onChange={e => set('venueType', e.target.value as EventInput['venueType'])}>
          <option value="ONLINE">Online</option><option value="PHYSICAL">Physical</option><option value="HYBRID">Hybrid</option></select><FieldError errors={fieldErrors} name="venueType" /></label>
        <label className="event-field"><span>Venue name</span><input {...validationProps('venueName')} value={form.venueName || ''} onChange={e => set('venueName', e.target.value)} /><FieldError errors={fieldErrors} name="venueName" /></label>
        <label className="event-field event-field-wide"><span>Physical address</span><textarea {...validationProps('physicalAddress')} rows={3} value={form.physicalAddress || ''} onChange={e => set('physicalAddress', e.target.value)} /><FieldError errors={fieldErrors} name="physicalAddress" /></label>
        <label className="event-field event-field-wide"><span>Online meeting URL</span><input {...validationProps('onlineMeetingUrl')} type="url" value={form.onlineMeetingUrl || ''} onChange={e => set('onlineMeetingUrl', e.target.value)} placeholder="https://" /><FieldError errors={fieldErrors} name="onlineMeetingUrl" /></label></div></section>
      <section><header><span>03</span><div><h2>Registration & fees</h2><p>Control the in-platform registration window and capacity.</p></div></header><div className="event-form-grid">
        <label className="event-field"><span>Registration start</span><input {...validationProps('registrationStart')} type="date" value={form.registrationStart || ''} onChange={e => set('registrationStart', e.target.value)} /><FieldError errors={fieldErrors} name="registrationStart" /></label>
        <label className="event-field"><span>Registration deadline</span><input {...validationProps('registrationDeadline')} type="date" value={form.registrationDeadline || ''} onChange={e => set('registrationDeadline', e.target.value)} /><FieldError errors={fieldErrors} name="registrationDeadline" /></label>
        <label className="event-field"><span>Capacity</span><input {...validationProps('capacity')} type="number" min="0" value={form.capacity ?? ''} onChange={e => set('capacity', e.target.value === '' ? null : Number(e.target.value))} /><FieldError errors={fieldErrors} name="capacity" /></label>
        <label className="event-field event-checkbox"><input {...validationProps('limitedSeats')} type="checkbox" checked={form.limitedSeats} onChange={e => set('limitedSeats', e.target.checked)} /><span>Limited seats</span><FieldError errors={fieldErrors} name="limitedSeats" /></label>
        <label className="event-field"><span>Member fee</span><input {...validationProps('memberFee')} type="number" min="0" step="0.01" value={form.memberFee} onChange={e => set('memberFee', Number(e.target.value))} /><FieldError errors={fieldErrors} name="memberFee" /></label>
        <label className="event-field"><span>Non-member fee</span><input {...validationProps('nonMemberFee')} type="number" min="0" step="0.01" value={form.nonMemberFee} onChange={e => set('nonMemberFee', Number(e.target.value))} /><FieldError errors={fieldErrors} name="nonMemberFee" /></label>
        <label className="event-field"><span>Currency</span><input {...validationProps('currency')} minLength={3} maxLength={3} value={form.currency} onChange={e => set('currency', e.target.value.toUpperCase())} /><FieldError errors={fieldErrors} name="currency" /></label>
        <label className="event-field"><span>Audience</span><select {...validationProps('targetAudience')} value={form.targetAudience} onChange={e => set('targetAudience', e.target.value as EventInput['targetAudience'])}>
          <option value="MEMBERS">Members</option><option value="NON_MEMBERS">Non-members</option><option value="MEMBERS_AND_NON_MEMBERS">Members and non-members</option></select><FieldError errors={fieldErrors} name="targetAudience" /></label>
        <label className="event-field event-field-wide"><span>Registration URL</span><input {...validationProps('registrationUrl')} type="url" value={form.registrationUrl || ''} onChange={e => set('registrationUrl', e.target.value)} placeholder="https://" /><FieldError errors={fieldErrors} name="registrationUrl" /></label>
        <label className="event-field event-field-wide"><span>Payment instructions</span><textarea {...validationProps('paymentInstructions')} rows={3} value={form.paymentInstructions || ''} onChange={e => set('paymentInstructions', e.target.value)} /><FieldError errors={fieldErrors} name="paymentInstructions" /></label></div></section>
      <footer className="event-form-actions"><div className="event-form-feedback" aria-live="polite">
        {message && <span className="is-success" role="status"><BadgeCheck />{message}</span>}
        {error && <span className="is-error" role="alert"><AlertCircle />{error}</span>}</div>
        <div className="event-form-buttons"><Link className="button button-ghost" href="/admin/events">Cancel</Link>
          <Button type="submit" disabled={saving}><Save />{saving ? 'Saving…' : id ? 'Save changes' : 'Create draft'}</Button></div>
      </footer></fieldset></form>
    {id && record?.status === 'DRAFT' && <section className="event-transition-card"><div><h2>Ready to publish?</h2><p>Publishing makes this event visible to active authenticated users.</p></div>
      <Button disabled={saving} onClick={() => void transition('publish')}><Send />Publish event</Button></section>}
    {id && record?.status === 'PUBLISHED' && <section className="event-transition-card event-transition-danger"><div><h2>Cancel event</h2><p>Cancellation removes it from the member event list.</p></div>
      <label><span>Reason</span><input value={cancelReason} maxLength={1000} onChange={e => setCancelReason(e.target.value)} /></label>
      <Button variant="secondary" disabled={saving || !cancelReason.trim()} onClick={() => void transition('cancel')}><Ban />Cancel event</Button></section>}
  </PageContainer>;
}
