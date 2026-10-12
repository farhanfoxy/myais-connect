'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, UsersRound } from 'lucide-react';
import { PageContainer, PageHeading } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import type { AdminMemberPage } from '@/lib/api-client';
import { createMemberApiClient } from '@/lib/member-api';
import { humanizeEnum } from '@/lib/roles';

export function MemberDirectory() {
  const api = useMemo(() => createMemberApiClient(), []); const [data, setData] = useState<AdminMemberPage | null>(null);
  const [draft, setDraft] = useState(''); const [query, setQuery] = useState({ search: '', membershipType: 'ALL',
    membershipStatus: 'ALL', accountStatus: 'ALL', sort: 'name', order: 'asc', page: '1', pageSize: '20' });
  const [error, setError] = useState(false);
  useEffect(() => { let active = true; api.listAdminMembers(query).then(value => { if (active) setData(value); })
    .catch(() => { if (active) { setError(true); setData({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }); } });
    return () => { active = false; }; }, [api, query]);
  function submit(event: FormEvent) { event.preventDefault(); setError(false); setData(null);
    setQuery(value => ({ ...value, search: draft.trim(), page: '1' })); }
  function setFilter(key: 'membershipType' | 'membershipStatus' | 'accountStatus' | 'sort', value: string) {
    setError(false); setData(null); setQuery(current => ({ ...current, [key]: value, page: '1' }));
  }
  return <PageContainer><PageHeading eyebrow="Membership operations" title="Member directory"
    description="A canonical, one-person-per-row view of MyAIS members and their current membership." />
    <form className="directory-toolbar" onSubmit={submit}><label><Search /><input value={draft} onChange={event => setDraft(event.target.value)}
      placeholder="Search name, member number or email" /></label><select aria-label="Membership type" value={query.membershipType}
      onChange={event => setFilter('membershipType', event.target.value)}><option value="ALL">All membership types</option>
      {['ORDINARY', 'LIFETIME', 'ASSOCIATE', 'HONORARY'].map(value => <option key={value}>{value}</option>)}</select>
      <select aria-label="Membership status" value={query.membershipStatus} onChange={event => setFilter('membershipStatus', event.target.value)}>
        <option value="ALL">All membership statuses</option>{['PENDING', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'TERMINATED'].map(value =>
          <option key={value}>{value}</option>)}</select><select aria-label="Account status" value={query.accountStatus}
          onChange={event => setFilter('accountStatus', event.target.value)}><option value="ALL">All account statuses</option>
          {['ACTIVE', 'DISABLED', 'SUSPENDED'].map(value => <option key={value}>{value}</option>)}</select><Button type="submit">Search</Button></form>
    <div className="directory-summary"><UsersRound /><strong>{data?.total ?? '—'}</strong><span>people match the current filters</span>
      <select aria-label="Sort members" value={query.sort} onChange={event => setFilter('sort', event.target.value)}>
        <option value="name">Sort by name</option><option value="email">Sort by email</option>
        <option value="accountStatus">Sort by account status</option><option value="createdAt">Sort by joined date</option></select></div>
    {!data && <div className="events-loading" role="status"><span /><span /><p>Loading members…</p></div>}
    {error && <div className="application-load-error" role="alert">The member directory could not be loaded.</div>}
    {data && data.items.length === 0 && !error && <section className="events-empty"><UsersRound /><h2>No members found</h2>
      <p>Try changing the search or filters.</p></section>}
    {data && data.items.length > 0 && <div className="responsive-table directory-table"><table><thead><tr><th>Member</th><th>Number</th>
      <th>Type</th><th>Membership</th><th>Joined</th><th>Valid until</th><th>Account</th><th /></tr></thead><tbody>{data.items.map(item =>
        <tr key={item.id}><td data-label="Member"><strong>{item.name || 'Name unavailable'}</strong><small>{item.email}</small></td>
          <td data-label="Number">{item.membership?.membershipNumber || '—'}</td><td data-label="Type">{item.membership?.membershipTypeName || '—'}</td>
          <td data-label="Membership"><span className={`status-badge status-${(item.membership?.status || 'none').toLowerCase()}`}>
            {humanizeEnum(item.membership?.status ?? null)}</span></td><td data-label="Joined">{item.joinedAt?.slice(0, 10) || '—'}</td>
          <td data-label="Valid until">{item.membership?.noExpiry ? 'No expiry' : item.membership?.expiryDate || '—'}</td>
          <td data-label="Account"><span className={`status-badge status-${(item.accountStatus || 'none').toLowerCase()}`}>
            {humanizeEnum(item.accountStatus)}</span></td><td><Link href={`/admin/members/${item.id}`}>View</Link></td></tr>)}</tbody></table></div>}
    {data && data.totalPages > 1 && <div className="pagination-controls"><Button variant="secondary" disabled={data.page <= 1}
      onClick={() => { setError(false); setData(null); setQuery(value => ({ ...value, page: String(Number(value.page) - 1) })); }}>Previous</Button>
      <span>Page {data.page} of {data.totalPages}</span><Button variant="secondary" disabled={data.page >= data.totalPages}
        onClick={() => { setError(false); setData(null); setQuery(value => ({ ...value, page: String(Number(value.page) + 1) })); }}>Next</Button></div>}
  </PageContainer>;
}
