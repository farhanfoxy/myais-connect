'use client';

import Link from 'next/link';
import {
  Activity, ArrowRight, CalendarDays, CalendarPlus, CircleDollarSign, Clock3, FileCheck2,
  RefreshCw, ShieldCheck, UsersRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { PageContainer, StatusBadge } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import type { AdminDashboardResponse } from '@/lib/api-client';
import { createAdminApiClient } from '@/lib/admin-api';
import { humanizeEnum } from '@/lib/roles';
import { statusLabel, statusTone } from '@/lib/member-status';

const chartColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const chartTick = { fontSize: 10, fill: 'var(--chart-axis)' };
const tooltipStyle = { border: '1px solid var(--border)', borderRadius: 10,
  background: 'var(--chart-tooltip)', color: 'var(--foreground)', boxShadow: 'var(--shadow-sm)' };
const tooltipLabelStyle = { color: 'var(--foreground)', fontWeight: 700 };
const tooltipItemStyle = { color: 'var(--foreground-muted)' };

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kuala_Lumpur',
  }).format(new Date()));
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short',
    timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(value));
}

function eventDate(value: string, time: string): string {
  const date = new Date(`${value}T${time || '00:00'}:00+08:00`);
  return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' }).format(date);
}

function money(value: string, currency = 'MYR'): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat('en-MY', { style: 'currency', currency }).format(amount) : value;
}

function ChartEmpty({ children }: Readonly<{ children: string }>) {
  return <div className="admin-chart-empty"><Activity /> <span>{children}</span></div>;
}

function ChartCard({ title, description, children, summary, className = '', empty = false }: Readonly<{
  title: string; description: string; children: ReactNode; summary: string; className?: string; empty?: boolean;
}>) {
  const id = `${title.replace(/\s/g, '-').toLowerCase()}-title`;
  return <section className={`admin-chart-card ${empty ? 'is-empty' : ''} ${className}`} aria-labelledby={id}>
    <header><div><p>Operational analytics</p><h2 id={id}>{title}</h2></div><span>{description}</span></header>
    <div className="admin-chart-body">{children}</div><p className="sr-only">{summary}</p>
  </section>;
}

function DashboardLoading() {
  return <PageContainer className="admin-command-page"><div className="admin-command-skeleton" role="status"
    aria-label="Loading administration dashboard"><span className="admin-skeleton-hero" /><div className="admin-skeleton-kpis">
      {Array.from({ length: 4 }, (_, index) => <span key={index} />)}</div><div className="admin-skeleton-panels">
      <span /><span /><span /></div></div></PageContainer>;
}

export function AdminCommandDashboard() {
  const api = useMemo(() => createAdminApiClient(), []);
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    setError(false); setData(null);
    api.getAdminDashboard().then(setData).catch(() => setError(true));
  }, [api]);
  useEffect(() => {
    let current = true;
    api.getAdminDashboard().then(value => { if (current) setData(value); })
      .catch(() => { if (current) setError(true); });
    return () => { current = false; };
  }, [api]);

  if (!data && !error) return <DashboardLoading />;
  if (error) return <PageContainer className="admin-command-page"><section className="admin-dashboard-error" role="alert">
    <ShieldCheck /><div><h1>Administration dashboard unavailable</h1>
      <p>We could not load the operational dashboard. No underlying records were changed.</p></div>
    <Button onClick={load}><RefreshCw /> Retry</Button></section></PageContainer>;
  if (!data) return null;

  const kpis = [
    { key: 'members', label: 'Active members', value: data.kpis.activeMembers,
      detail: 'Canonical current memberships', icon: UsersRound },
    data.kpis.applicationsNeedingReview === undefined ? null : { key: 'applications', label: 'Applications needing review',
      value: data.kpis.applicationsNeedingReview, detail: 'Submitted or under review', icon: FileCheck2,
      href: '/admin/applications' },
    data.kpis.finalApprovals === undefined ? null : { key: 'approvals', label: 'Final approval',
      value: data.kpis.finalApprovals, detail: 'Recommended for approval', icon: ShieldCheck,
      href: '/admin/applications?status=RECOMMENDED_FOR_APPROVAL' },
    data.kpis.paymentsToVerify === undefined ? null : { key: 'payments', label: 'Payments to verify',
      value: data.kpis.paymentsToVerify, detail: 'Submitted or under verification', icon: CircleDollarSign,
      href: '/admin/payments' },
    { key: 'events', label: 'Upcoming events', value: data.kpis.upcomingEvents, detail: 'Published future events',
      icon: CalendarDays, href: data.permissions.manageEvents ? '/admin/events' : '/events' },
  ].filter(item => item !== null);
  const membershipActivity = data.charts.membershipActivity ?? [];
  const distribution = data.charts.membershipDistribution ?? [];
  const pipeline = (data.charts.applicationPipeline ?? []).map(item => ({ ...item, label: statusLabel(item.status) }));
  const applicationActivity = data.charts.applicationActivity ?? [];
  const paymentStatus = (data.charts.paymentStatus ?? []).map(item => ({ ...item, label: statusLabel(item.status) }));

  return <PageContainer className="admin-command-page">
    <header className="admin-command-header"><div><div className="admin-command-role"><ShieldCheck />
      {humanizeEnum(data.viewer.role)}</div><h1>{greeting()}, {data.viewer.displayName}</h1>
      <p>Here&apos;s what needs your attention today.</p></div><div className="admin-command-actions">
      {data.permissions.reviewApplications && <Link className="button button-secondary" href="/admin/applications">
        <FileCheck2 /> Application queue</Link>}
      {data.permissions.verifyPayments && <Link className="button button-secondary" href="/admin/payments">
        <CircleDollarSign /> Verify payments</Link>}
      {data.permissions.manageEvents && <Link className="button button-primary" href="/admin/events/new">
        <CalendarPlus /> Create event</Link>}</div></header>

    <section className="admin-kpi-grid" aria-label="Operational summary">{kpis.map(item => {
      const Icon = item.icon; const content = <><span className="admin-kpi-icon"><Icon /></span><div><p>{item.label}</p>
        <strong>{item.value}</strong><small>{item.detail}</small></div>{item.href && <ArrowRight className="admin-kpi-arrow" />}</>;
      return item.href ? <Link className="admin-kpi-card is-actionable" href={item.href} key={item.key}>{content}</Link> :
        <article className="admin-kpi-card" key={item.key}>{content}</article>;
    })}</section>

    {(membershipActivity.length > 0 || distribution.length > 0) && <div className="admin-chart-grid admin-chart-grid-primary">
      {membershipActivity.length > 0 && <ChartCard className="admin-chart-wide" title="Membership activations"
        description="Distinct members activated each month" empty={!membershipActivity.some(item => item.value > 0)}
        summary={membershipActivity.map(item => `${item.label}: ${item.value}`).join(', ')}>
        {membershipActivity.some(item => item.value > 0) ? <ResponsiveContainer width="100%" height="100%"><LineChart data={membershipActivity}
          accessibilityLayer margin={{ top: 12, right: 12, left: -22, bottom: 0 }}><CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" tick={chartTick} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={chartTick} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
          <Line type="monotone" dataKey="value" name="Activated memberships" stroke="var(--chart-1)" strokeWidth={3}
            dot={{ r: 3, fill: 'var(--chart-1)' }} activeDot={{ r: 5 }} isAnimationActive={false} /></LineChart></ResponsiveContainer> :
          <ChartEmpty>No memberships were activated in this period.</ChartEmpty>}</ChartCard>}
      {distribution.length > 0 && <ChartCard title="Membership distribution" description="Current active members"
        empty={!distribution.some(item => item.value > 0)} summary={distribution.map(item => `${item.name}: ${item.value}`).join(', ')}>
        {distribution.some(item => item.value > 0) ? <div className="admin-donut-layout"><ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer><Pie data={distribution} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%"
            paddingAngle={2} isAnimationActive={false}>{distribution.map((item, index) =>
              <Cell key={item.code} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip
                contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} /></PieChart></ResponsiveContainer>
          <ul>{distribution.map((item, index) => <li key={item.code}><i style={{ background: chartColors[index % chartColors.length] }} />
            <span>{item.name}</span><strong>{item.value}</strong></li>)}</ul></div> :
          <ChartEmpty>No active membership records are available.</ChartEmpty>}</ChartCard>}
    </div>}

    {(pipeline.length > 0 || paymentStatus.length > 0 || applicationActivity.length > 0) && <div className="admin-chart-grid">
      {pipeline.length > 0 && <ChartCard title="Application pipeline" description="Current non-terminal workload"
        empty={!pipeline.some(item => item.value > 0)} summary={pipeline.map(item => `${item.label}: ${item.value}`).join(', ')}>{pipeline.some(item => item.value > 0) ?
          <ResponsiveContainer width="100%" height="100%"><BarChart data={pipeline} layout="vertical" accessibilityLayer
            margin={{ top: 5, right: 12, left: 18, bottom: 0 }}><CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={chartTick} />
            <YAxis type="category" dataKey="label" width={112} axisLine={false} tickLine={false}
              tick={{ ...chartTick, fontSize: 9.5 }} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
            <Bar dataKey="value" name="Applications" fill="var(--chart-2)" radius={[0, 6, 6, 0]}
              isAnimationActive={false} /></BarChart></ResponsiveContainer> :
          <ChartEmpty>No applications are in the active pipeline.</ChartEmpty>}</ChartCard>}
      {applicationActivity.length > 0 && <ChartCard title="Application activity" description="Applications submitted by month"
        empty={!applicationActivity.some(item => item.value > 0)}
        summary={applicationActivity.map(item => `${item.label}: ${item.value}`).join(', ')}>
        {applicationActivity.some(item => item.value > 0) ? <ResponsiveContainer width="100%" height="100%"><LineChart
          data={applicationActivity} accessibilityLayer margin={{ top: 12, right: 12, left: -22, bottom: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false}
            tick={chartTick} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={chartTick} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
          <Line type="monotone" dataKey="value" name="Submitted applications" stroke="var(--chart-3)" strokeWidth={3}
            isAnimationActive={false} /></LineChart></ResponsiveContainer> :
          <ChartEmpty>No applications were submitted in this period.</ChartEmpty>}</ChartCard>}
      {paymentStatus.length > 0 && <ChartCard title="Payment verification status" description="Current verification workload"
        empty={!paymentStatus.some(item => item.value > 0)} summary={paymentStatus.map(item => `${item.label}: ${item.value}`).join(', ')}>{paymentStatus.some(item => item.value > 0) ?
          <ResponsiveContainer width="100%" height="100%"><BarChart data={paymentStatus} accessibilityLayer
            margin={{ top: 12, right: 12, left: -22, bottom: 0 }}><CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ ...chartTick, fontSize: 9 }} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={chartTick} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
            <Bar dataKey="value" name="Payments" fill="var(--chart-1)" radius={[6, 6, 0, 0]}
              isAnimationActive={false} /></BarChart></ResponsiveContainer> :
          <ChartEmpty>No payment verification records are available.</ChartEmpty>}</ChartCard>}
    </div>}

    <div className="admin-operations-grid"><section className="admin-operation-card admin-attention-card"><header><div><p>Prioritized queue</p>
      <h2>Needs Your Attention</h2></div><Clock3 /></header>{data.attention.length === 0 ? <div className="admin-compact-empty">
      <ShieldCheck /><div><strong>You&apos;re all caught up.</strong><span>No authorized work items need attention.</span></div></div> :
      <ol>{data.attention.map(item => <li key={`${item.kind}-${item.id}`}><Link href={item.href}><div><strong>{item.reference ||
        (item.kind === 'PAYMENT' ? 'Payment record' : 'Application')}</strong><span>{item.personName}</span></div>
        <div className="admin-attention-state"><StatusBadge tone={statusTone(item.status)}>{statusLabel(item.status)}</StatusBadge>
          {item.amount && <b>{money(item.amount, item.currency)}</b>}<small>{item.waitingLabel}</small></div><ArrowRight /></Link></li>)}</ol>}
      {data.attention.length > 0 && <Link className="admin-panel-link" href={data.permissions.verifyPayments && !data.permissions.reviewApplications
        ? '/admin/payments' : '/admin/applications'}>View full queue <ArrowRight /></Link>}</section>

      <section className="admin-operation-card"><header><div><p>Membership insight</p><h2>Expiring soon</h2></div><UsersRound /></header>
        <div className="admin-insight"><strong>{data.operationalInsights.membershipsExpiringSoon}</strong>
          <div><b>Active memberships</b><span>with a real expiry date in the next {data.operationalInsights.windowDays} days</span></div></div></section>
    </div>

    <div className="admin-operations-grid"><section className="admin-operation-card"><header><div><p>Published programme</p>
      <h2>Upcoming events</h2></div><CalendarDays /></header>{data.upcomingEvents.length === 0 ? <div className="admin-compact-empty">
      <CalendarDays /><div><strong>No upcoming events</strong><span>No future published events are available.</span></div></div> :
      <ul className="admin-event-list">{data.upcomingEvents.map(event => <li key={event.id}><Link
        href={data.permissions.manageEvents ? `/admin/events/${event.id}` : `/events/${event.id}`}><time dateTime={event.startDate}>
          {eventDate(event.startDate, event.startTime)}</time><strong>{event.title}</strong><span>{event.eventNumber || statusLabel(event.venueType)}
            {event.venueName ? ` · ${event.venueName}` : ''} · {event.registrationCount} registered</span><ArrowRight /></Link></li>)}</ul>}
      <Link className="admin-panel-link" href={data.permissions.manageEvents ? '/admin/events' : '/events'}>
        {data.permissions.manageEvents ? 'Manage events' : 'View events'} <ArrowRight /></Link></section>

      <section className="admin-operation-card"><header><div><p>Safe audit projection</p><h2>Recent activity</h2></div><Activity /></header>
        {data.recentActivity.length === 0 ? <div className="admin-compact-empty"><Activity /><div><strong>No recent activity</strong>
          <span>No relevant audit events are available.</span></div></div> : <ol className="admin-activity-list">{data.recentActivity.map((item, index) =>
          <li key={`${item.action}-${item.createdAt}-${index}`}><i /><div><strong>{item.label}</strong>
            <span>{item.reference || humanizeEnum(item.entityType)}{item.actorName ? ` · ${item.actorName}` : ''}</span>
            <time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time></div></li>)}</ol>}</section></div>
  </PageContainer>;
}
