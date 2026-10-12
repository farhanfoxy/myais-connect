'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, CreditCard, FileText, UserRound } from 'lucide-react';
import { PageContainer } from '@/components/dashboard/dashboard-ui';
import type { AdminMemberDetail } from '@/lib/api-client';
import { createMemberApiClient } from '@/lib/member-api';
import { humanizeEnum } from '@/lib/roles';

export function MemberDetail({ id }: Readonly<{ id: string }>) {
  const api = useMemo(() => createMemberApiClient(), []); const [data, setData] = useState<AdminMemberDetail | null | undefined>(undefined);
  useEffect(() => { let active = true; api.getAdminMember(id).then(value => { if (active) setData(value); })
    .catch(() => { if (active) setData(null); }); return () => { active = false; }; }, [api, id]);
  if (data === undefined) return <PageContainer><div className="events-loading" role="status"><span /><p>Loading member…</p></div></PageContainer>;
  if (!data) return <PageContainer><section className="events-empty"><UserRound /><h1>Member not found</h1>
    <Link className="button button-secondary" href="/admin/members">Back to directory</Link></section></PageContainer>;
  const profile = data.profile; const membership = data.currentMembership;
  return <PageContainer className="member-detail-page"><Link className="event-back-link" href="/admin/members"><ArrowLeft />Member directory</Link>
    <header className="member-detail-header"><div className="member-detail-avatar">{(profile.name || profile.email || 'M').charAt(0).toUpperCase()}</div>
      <div><span>Member record</span><h1>{profile.name || 'Name unavailable'}</h1><p>{profile.email}</p></div>
      <span className={`status-badge status-${(profile.accountStatus || 'none').toLowerCase()}`}>{humanizeEnum(profile.accountStatus)}</span></header>
    <section className="member-detail-grid"><article><h2>Profile summary</h2><dl><div><dt>Role</dt><dd>{humanizeEnum(profile.role)}</dd></div>
      <div><dt>Phone</dt><dd>{profile.phoneNumber || 'Not provided'}</dd></div><div><dt>Institution</dt><dd>{profile.institution || 'Not provided'}</dd></div>
      <div><dt>Occupation</dt><dd>{profile.occupation || 'Not provided'}</dd></div><div><dt>Location</dt><dd>{[profile.city, profile.state, profile.country].filter(Boolean).join(', ') || 'Not provided'}</dd></div></dl></article>
      <article><h2>Current membership</h2>{membership ? <dl><div><dt>Member number</dt><dd>{membership.membershipNumber || '—'}</dd></div>
        <div><dt>Type</dt><dd>{membership.membershipTypeName}</dd></div><div><dt>Status</dt><dd>{humanizeEnum(membership.status)}</dd></div>
        <div><dt>Valid until</dt><dd>{membership.noExpiry ? 'No expiry' : membership.expiryDate || '—'}</dd></div></dl> : <p>No membership record.</p>}</article></section>
    <section className="member-history-section"><h2><CalendarDays />Membership history</h2><div className="history-list">{data.membershipHistory.map(item =>
      <div key={item.id}><strong>{item.membershipTypeName || 'Membership'}</strong><span>{item.membershipNumber || 'No number'}</span>
        <span>{humanizeEnum(item.status)}</span><time>{item.startDate || '—'} → {item.noExpiry ? 'No expiry' : item.expiryDate || '—'}</time></div>)}
      {data.membershipHistory.length === 0 && <p>No membership history.</p>}</div></section>
    <div className="member-detail-columns"><section className="member-history-section"><h2><FileText />Applications</h2><div className="history-list">
      {data.applicationHistory.map(item => <div key={item.id}><strong>{item.applicationNumber || 'Draft application'}</strong>
        <span>{humanizeEnum(item.status ?? null)}</span><time>{item.submittedAt?.slice(0, 10) || item.createdAt?.slice(0, 10)}</time></div>)}
      {data.applicationHistory.length === 0 && <p>No applications.</p>}</div></section>
      <section className="member-history-section"><h2><CreditCard />Payments</h2><div className="history-list">{data.paymentHistory.map(item =>
        <div key={item.id}><strong>{item.paymentReference || 'Payment'}</strong><span>{humanizeEnum(item.status ?? null)}</span>
          <time>{item.submittedAt?.slice(0, 10) || item.createdAt?.slice(0, 10)}</time></div>)}{data.paymentHistory.length === 0 && <p>No payments.</p>}</div></section></div>
    <section className="member-history-section"><h2>Event registrations</h2><div className="history-list">{data.eventRegistrations.map(item =>
      <div key={item.id}><strong>{item.event.title}</strong><span>{humanizeEnum(item.status)}</span><time>{item.event.startDate}</time></div>)}
      {data.eventRegistrations.length === 0 && <p>No event registrations.</p>}</div></section>
    <section className="member-history-section"><h2>Recent member activity</h2><div className="history-list">{data.activity.map(item =>
      <div key={item.id}><strong>{humanizeEnum(item.action)}</strong><span>{item.description}</span><time>{new Date(item.createdAt).toLocaleString('en-MY')}</time></div>)}
      {data.activity.length === 0 && <p>No recent activity.</p>}</div></section>
  </PageContainer>;
}
