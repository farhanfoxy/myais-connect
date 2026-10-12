'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Archive, Megaphone, Plus, Send } from 'lucide-react';
import { PageContainer, PageHeading, StatusBadge } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import type { AnnouncementRecord } from '@/lib/api-client';
import { createMemberApiClient } from '@/lib/member-api';
import { statusLabel } from '@/lib/member-status';

export function AnnouncementWorkspace() { const api = useMemo(() => createMemberApiClient(), []);
  const [items, setItems] = useState<AnnouncementRecord[] | null>(null); const load = useCallback(() => {
    void api.listAdminAnnouncements().then(page => setItems(page.items)); }, [api]); useEffect(load, [load]);
  async function action(id: string, kind: 'publish' | 'archive') { if (kind === 'publish') await api.publishAnnouncement(id);
    else await api.archiveAnnouncement(id); load(); }
  return <PageContainer><PageHeading eyebrow="Communications" title="Announcements"
    description="Draft, publish and archive official MyAIS updates." /><div className="page-primary-action">
      <Link className="button button-primary" href="/admin/announcements/new"><Plus />New announcement</Link></div>
    <div className="admin-announcement-list">{items === null ? <p>Loading announcements…</p> : items.length ? items.map(item =>
      <article key={item.id}><div><StatusBadge>{statusLabel(item.status)}</StatusBadge><span>{item.targetAudience}</span></div>
        <h2>{item.title}</h2><p>{item.summary || item.content.slice(0, 160)}</p><footer>
          <Link className="button button-secondary" href={`/admin/announcements/${item.id}`}>{item.status === 'DRAFT' ? 'Edit draft' : 'View'}</Link>
          {item.status === 'DRAFT' && <Button onClick={() => void action(item.id, 'publish')}><Send />Publish</Button>}
          {item.status === 'PUBLISHED' && <Button variant="secondary" onClick={() => void action(item.id, 'archive')}><Archive />Archive</Button>}
        </footer></article>) : <div className="news-empty"><Megaphone /><div><h2>No announcements</h2><p>Create a draft when there is news to share.</p></div></div>}</div>
  </PageContainer>; }

const empty = { title: '', summary: '', content: '', category: 'GENERAL', targetAudience: 'ALL', expiryAt: '' };
export function AnnouncementEditor({ id }: Readonly<{ id?: string }>) { const api = useMemo(() => createMemberApiClient(), []);
  const [form, setForm] = useState(empty); const [status, setStatus] = useState('DRAFT'); const [message, setMessage] = useState('');
  useEffect(() => { if (!id) return; void api.getAdminAnnouncement(id).then(item => { setStatus(item.status ?? 'DRAFT'); setForm({
    title: item.title, summary: item.summary ?? '', content: item.content, category: item.category ?? 'GENERAL',
    targetAudience: item.targetAudience ?? 'ALL', expiryAt: item.expiresAt?.slice(0, 16) ?? '' }); }); }, [api, id]);
  async function submit(event: FormEvent) { event.preventDefault(); setMessage('Saving…'); const payload = { ...form,
    summary: form.summary || null, expiryAt: form.expiryAt ? new Date(form.expiryAt).toISOString() : null };
    try { if (id) await api.updateAnnouncement(id, payload); else await api.createAnnouncement(payload); setMessage('Draft saved.'); }
    catch { setMessage('The draft could not be saved.'); } }
  return <PageContainer><PageHeading eyebrow="Communications" title={id ? 'Announcement' : 'New announcement'}
    description="Content remains private until an authorized manager publishes it." />
    <form className="announcement-form" onSubmit={submit}><label>Title<input required maxLength={200} value={form.title}
      onChange={event => setForm(value => ({ ...value, title: event.target.value }))} /></label>
      <label>Summary<textarea maxLength={500} rows={3} value={form.summary} onChange={event => setForm(value => ({ ...value, summary: event.target.value }))} /></label>
      <div className="announcement-form-row"><label>Category<select value={form.category} onChange={event => setForm(value => ({ ...value, category: event.target.value }))}>
        {['GENERAL', 'EVENT', 'MEMBERSHIP', 'POLICY', 'TRAINING'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Audience<select value={form.targetAudience} onChange={event => setForm(value => ({ ...value, targetAudience: event.target.value }))}>
          {['ALL', 'MEMBERS', 'APPLICANTS', 'COMMITTEE'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Expires (optional)<input type="datetime-local" value={form.expiryAt} onChange={event => setForm(value => ({ ...value, expiryAt: event.target.value }))} /></label></div>
      <label>Content<textarea required rows={14} value={form.content} onChange={event => setForm(value => ({ ...value, content: event.target.value }))} /></label>
      <footer><Link className="button button-secondary" href="/admin/announcements">Back</Link>
        <Button type="submit" disabled={status !== 'DRAFT'}>{id ? 'Save changes' : 'Create draft'}</Button></footer>
      {message && <p role="status">{message}</p>}</form></PageContainer>; }
