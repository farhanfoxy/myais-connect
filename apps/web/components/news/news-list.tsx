'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import { PageContainer, PageHeading, StatusBadge } from '@/components/dashboard/dashboard-ui';
import type { AnnouncementRecord } from '@/lib/api-client';
import { createMemberApiClient } from '@/lib/member-api';

function date(value: string | null) { return value ? new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium',
  timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(value)) : 'Publication date unavailable'; }

export function NewsList({ limit }: Readonly<{ limit?: number }>) {
  const api = useMemo(() => createMemberApiClient(), []); const [items, setItems] = useState<AnnouncementRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let active = true; if (typeof api.listAnnouncements !== 'function') {
    queueMicrotask(() => { if (active) setItems([]); }); return () => { active = false; }; }
    api.listAnnouncements().then(value => { if (active) setItems(limit ? value.slice(0, limit) : value); })
    .catch(() => { if (active) setFailed(true); }); return () => { active = false; }; }, [api, limit]);
  if (failed) return <div className="data-message data-message-error" role="alert">News could not be loaded.</div>;
  if (!items) return <div className="news-loading" role="status">Loading announcements…</div>;
  if (!items.length) return <div className="news-empty"><Megaphone /><div><h3>No announcements yet</h3>
    <p>Published MyAIS updates relevant to you will appear here.</p></div></div>;
  return <div className="news-grid">{items.map(item => <article className="news-card" key={item.id}>
    <div><StatusBadge>{item.category ?? 'General'}</StatusBadge><time>{date(item.publishedAt)}</time></div>
    <h2>{item.title}</h2><p>{item.summary || item.content.slice(0, 180)}</p>
    <Link href={`/news/${item.id}`}>Read announcement</Link></article>)}</div>;
}

export function NewsPage() { return <PageContainer><PageHeading eyebrow="MyAIS updates" title="News & announcements"
  description="Official updates relevant to your membership and MyAIS community." /><NewsList /></PageContainer>; }

export function NewsDetail({ id }: Readonly<{ id: string }>) { const api = useMemo(() => createMemberApiClient(), []);
  const [item, setItem] = useState<AnnouncementRecord | null>(); useEffect(() => { let active = true;
    api.getAnnouncement(id).then(value => { if (active) setItem(value); }).catch(() => { if (active) setItem(null); });
    return () => { active = false; }; }, [api, id]);
  return <PageContainer>{item === undefined ? <div className="news-loading">Loading announcement…</div> : item === null ?
    <div className="news-empty"><h2>Announcement unavailable</h2><Link href="/news">Back to news</Link></div> :
    <article className="news-detail"><Link href="/news">← All announcements</Link><div><StatusBadge>{item.category ?? 'General'}</StatusBadge>
      <time>{date(item.publishedAt)}</time></div><h1>{item.title}</h1>{item.summary && <p className="news-lead">{item.summary}</p>}
      <div className="news-content">{item.content.split('\n').map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>)}</div></article>}
  </PageContainer>; }
