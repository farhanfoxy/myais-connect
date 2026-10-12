'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { History, Search } from 'lucide-react';
import { PageContainer, PageHeading } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import type { AuditLogPage } from '@/lib/api-client';
import { createMemberApiClient } from '@/lib/member-api';

export function AuditLogViewer() {
  const api = useMemo(() => createMemberApiClient(), []); const [data, setData] = useState<AuditLogPage | null>(null);
  const [draft, setDraft] = useState({ actor: '', action: '', entity: '', from: '', to: '' });
  const [query, setQuery] = useState({ ...draft, page: '1', pageSize: '25' }); const [error, setError] = useState(false);
  useEffect(() => { let active = true; const values = Object.fromEntries(Object.entries(query).filter(([, value]) => value));
    api.listAuditLogs(values).then(value => { if (active) setData(value); }).catch(() => { if (active) { setError(true); setData(null); } });
    return () => { active = false; }; }, [api, query]);
  function submit(event: FormEvent) { event.preventDefault(); setError(false); setData(null);
    setQuery({ ...draft, page: '1', pageSize: '25' }); }
  return <PageContainer><PageHeading eyebrow="System accountability" title="Audit log"
    description="A read-only operational history of meaningful actions in MyAIS Connect." />
    <form className="audit-filters" onSubmit={submit}><label><span>Actor</span><input value={draft.actor}
      onChange={event => setDraft(value => ({ ...value, actor: event.target.value }))} placeholder="Name or email" /></label>
      <label><span>Action</span><input value={draft.action} onChange={event => setDraft(value => ({ ...value, action: event.target.value.toUpperCase() }))}
        placeholder="e.g. EVENT" /></label><label><span>Entity</span><input value={draft.entity}
          onChange={event => setDraft(value => ({ ...value, entity: event.target.value }))} placeholder="e.g. Event" /></label>
      <label><span>From</span><input type="date" value={draft.from} onChange={event => setDraft(value => ({ ...value, from: event.target.value }))} /></label>
      <label><span>To</span><input type="date" value={draft.to} onChange={event => setDraft(value => ({ ...value, to: event.target.value }))} /></label>
      <Button type="submit"><Search />Filter</Button></form>
    {!data && !error && <div className="events-loading" role="status"><span /><span /><p>Loading audit history…</p></div>}
    {error && <div className="application-load-error" role="alert">The audit history could not be loaded.</div>}
    {data?.items.length === 0 && <section className="events-empty"><History /><h2>No audit entries found</h2><p>Try adjusting the filters.</p></section>}
    {data && data.items.length > 0 && <div className="audit-list">{data.items.map(item => <article key={item.id}>
      <span><History /></span><div><div><strong>{item.actionLabel}</strong>{item.entityType && <small>{item.entityType}</small>}</div>
        <p>{item.description}</p><footer><span>{item.actorName}</span><time>{new Date(item.createdAt).toLocaleString('en-MY')}</time></footer></div></article>)}</div>}
    {data && data.totalPages > 1 && <div className="pagination-controls"><Button variant="secondary" disabled={data.page <= 1}
      onClick={() => { setError(false); setData(null); setQuery(value => ({ ...value, page: String(Number(value.page) - 1) })); }}>Previous</Button>
      <span>Page {data.page} of {data.totalPages}</span><Button variant="secondary" disabled={data.page >= data.totalPages}
        onClick={() => { setError(false); setData(null); setQuery(value => ({ ...value, page: String(Number(value.page) + 1) })); }}>Next</Button></div>}
  </PageContainer>;
}
