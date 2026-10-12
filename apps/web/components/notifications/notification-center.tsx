'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import type { NotificationRecord } from '@/lib/api-client';
import { createMemberApiClient } from '@/lib/member-api';
import { cn } from '@/lib/utils';

function time(value: string) { return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short',
  timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(value)); }

export function NotificationBell() {
  const api = useMemo(() => { try { return createMemberApiClient(); } catch { return null; } }, []);
  const [open, setOpen] = useState(false); const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationRecord[]>([]); const trigger = useRef<HTMLButtonElement>(null); const panel = useRef<HTMLDivElement>(null);
  const loadCount = useCallback(() => { if (api) void api.getUnreadNotificationCount().then(value => setCount(value.count)).catch(() => undefined); }, [api]);
  useEffect(loadCount, [loadCount]);
  useEffect(() => { if (!open || !api) return; void api.listNotifications({ pageSize: 6 }).then(page => setItems(page.items));
    const close = (event: PointerEvent) => { const target = event.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); }; }, [api, open]);
  async function mark(item: NotificationRecord) { if (!api) return; if (!item.isRead) { await api.markNotificationRead(item.id); setCount(value => Math.max(0, value - 1)); }
    setOpen(false); }
  return <div className="notification-menu"><button ref={trigger} className="header-icon-button" aria-label={count ?
    `Notifications, ${count} unread` : 'Notifications'} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)}>
    <Bell size={19} />{count > 0 && <span className="notification-count">{count > 99 ? '99+' : count}</span>}</button>
    {open && <div ref={panel} className="notification-popover" role="dialog" aria-label="Recent notifications">
      <header><div><strong>Notifications</strong><span>{count ? `${count} unread` : 'You are all caught up'}</span></div>
        {count > 0 && api && <button onClick={() => void api.markAllNotificationsRead().then(() => { setCount(0);
          setItems(current => current.map(item => ({ ...item, isRead: true }))); })}><CheckCheck />Mark all read</button>}</header>
      <div className="notification-popover-list">{items.length ? items.map(item => <Link key={item.id}
        className={cn('notification-item', !item.isRead && 'is-unread')} href={item.actionUrl || '/notifications'} onClick={() => void mark(item)}>
        <span className="notification-dot" aria-hidden="true" /><div><strong>{item.title}</strong><p>{item.message}</p><time>{time(item.createdAt)}</time></div></Link>) :
        <p className="notification-empty">No notifications yet.</p>}</div><Link className="notification-view-all" href="/notifications" onClick={() => setOpen(false)}>View all notifications</Link>
    </div>}</div>;
}

export function NotificationsPage() { const api = useMemo(() => createMemberApiClient(), []);
  const [unreadOnly, setUnreadOnly] = useState(false); const [items, setItems] = useState<NotificationRecord[] | null>(null);
  const load = useCallback(() => api.listNotifications({ unreadOnly, pageSize: 50 }).then(page => setItems(page.items)), [api, unreadOnly]);
  useEffect(() => { let active = true; void api.listNotifications({ unreadOnly, pageSize: 50 }).then(page => {
    if (active) setItems(page.items); }); return () => { active = false; }; }, [api, unreadOnly]);
  async function read(item: NotificationRecord) { if (!item.isRead) await api.markNotificationRead(item.id); await load(); }
  return <div className="page-container notifications-page"><div className="page-heading"><div><p>Inbox</p><h1>Notifications</h1>
    <span>Application, payment, membership and MyAIS updates.</span></div></div>
    <div className="notification-toolbar" role="group" aria-label="Notification filters"><button className={!unreadOnly ? 'is-active' : ''}
      onClick={() => setUnreadOnly(false)}>All</button><button className={unreadOnly ? 'is-active' : ''} onClick={() => setUnreadOnly(true)}>Unread</button>
      <button onClick={() => void api.markAllNotificationsRead().then(load)}><CheckCheck />Mark all read</button></div>
    <section className="notification-page-list">{items === null ? <p>Loading notifications…</p> : items.length ? items.map(item =>
      <article className={cn('notification-page-item', !item.isRead && 'is-unread')} key={item.id}><span className="notification-dot" />
        <div><h2>{item.title}</h2><p>{item.message}</p><time>{time(item.createdAt)}</time></div><div>
          {!item.isRead && <button onClick={() => void read(item)}>Mark read</button>}{item.actionUrl && <Link href={item.actionUrl} onClick={() => void read(item)}>View</Link>}</div></article>) :
      <div className="news-empty"><Bell /><div><h2>No notifications</h2><p>{unreadOnly ? 'You have no unread notifications.' : 'System updates will appear here.'}</p></div></div>}</section>
  </div>; }
