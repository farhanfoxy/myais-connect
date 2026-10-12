'use client';

import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { PageContainer, PageHeading } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { createMemberApiClient } from '@/lib/member-api';

const reports = [
  { id: 'member-directory', title: 'Member Directory', description: 'Contact and professional directory fields.' },
  { id: 'membership', title: 'Membership', description: 'Membership type, status and validity.' },
  { id: 'application', title: 'Applications', description: 'Application pipeline and decision dates.' },
  { id: 'payment', title: 'Payments', description: 'Payment references, amounts and verification status.' },
  { id: 'event', title: 'Events', description: 'Event schedule, category and publication status.' },
] as const;

function reportErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'The report could not be generated. Please try again.';
  if (error.status === 403) return 'You do not have permission to export this report.';
  if (error.status === 400) return 'Check the selected filters and date range, then try again.';
  if (error.status === 401) return 'Your session has expired. Sign in again to export reports.';
  return 'The report service is temporarily unavailable. Please try again.';
}

export function ReportsWorkspace() { const api = useMemo(() => createMemberApiClient(), []); const { state } = useAuth();
  const [type, setType] = useState<string>('member-directory'); const [format, setFormat] = useState('xlsx');
  const [status, setStatus] = useState(''); const [membershipType, setMembershipType] = useState(''); const [from, setFrom] = useState('');
  const [to, setTo] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  if (state.status !== 'authenticated') return null;
  const role = state.user.role; const available = reports.filter(report => role === 'PRESIDENT' || role === 'SYSTEM_ADMINISTRATOR' ||
    role === 'TREASURER' ? report.id === 'payment' || role !== 'TREASURER' : report.id !== 'payment');
  const selected = available.some(item => item.id === type) ? type : available[0]?.id ?? 'member-directory';
  async function download() { setBusy(true); setMessage('Preparing export…'); try { const query: Record<string, string> = { format };
    if (status) query.status = status; if (membershipType) query.membershipType = membershipType; if (from) query.from = from; if (to) query.to = to;
    const file = await api.downloadReport(selected, query); const url = URL.createObjectURL(file.blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = file.filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0); setMessage('Report downloaded.');
    } catch (error) { setMessage(reportErrorMessage(error)); } finally { setBusy(false); } }
  return <PageContainer><PageHeading eyebrow="Operations" title="Reports & exports"
    description="Generate authorized operational reports without direct database access." />
    <div className="reports-layout"><aside className="report-types" aria-label="Report categories">{available.map(report =>
      <button className={selected === report.id ? 'is-active' : ''} key={report.id} onClick={() => { setType(report.id); setStatus(''); }}>
        <FileSpreadsheet /><span><strong>{report.title}</strong><small>{report.description}</small></span></button>)}</aside>
      <section className="report-builder"><header><h2>{available.find(item => item.id === selected)?.title} report</h2>
        <p>Filters are applied by the secure MyAIS API before export.</p></header>
        <div className="report-filters"><label>Status<input value={status} onChange={event => setStatus(event.target.value.toUpperCase())}
          placeholder="e.g. ACTIVE" /></label>{['member-directory', 'membership', 'application'].includes(selected) &&
          <label>Membership type<select value={membershipType} onChange={event => setMembershipType(event.target.value)}>
            <option value="">All types</option>{['ORDINARY', 'LIFETIME', 'ASSOCIATE', 'HONORARY'].map(value => <option key={value}>{value}</option>)}</select></label>}
          <label>From<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
          <label>To<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
          <label>Format<select value={format} onChange={event => setFormat(event.target.value)}><option value="xlsx">Excel (.xlsx)</option>
            <option value="csv">CSV (.csv)</option></select></label></div>
        <Button onClick={() => void download()} disabled={busy}><Download />{busy ? 'Generating…' : `Download ${format.toUpperCase()}`}</Button>
        {message && <p className="report-message" role="status">{message}</p>}</section></div>
  </PageContainer>; }
