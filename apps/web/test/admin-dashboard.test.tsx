// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminCommandDashboard } from '@/components/admin/admin-command-dashboard';
import { ApiClient, type AdminDashboardResponse } from '@/lib/api-client';

const fixture = vi.hoisted(() => ({ getAdminDashboard: vi.fn() }));

vi.mock('@/lib/admin-api', () => ({ createAdminApiClient: () => fixture }));
vi.mock('recharts', async () => {
  const React = await import('react');
  const Container = ({ children }: { children?: React.ReactNode }) => React.createElement('div', {}, children);
  const Element = ({ children }: { children?: React.ReactNode }) => React.createElement('div', {}, children);
  return {
    ResponsiveContainer: Container, BarChart: Element, LineChart: Element, PieChart: Element, Pie: Element,
    Bar: Element, Line: Element, CartesianGrid: Element, Tooltip: Element, XAxis: Element, YAxis: Element,
    Cell: () => null,
  };
});

function systemDashboard(): AdminDashboardResponse {
  return {
    viewer: { displayName: 'Dr. Hapini', role: 'SYSTEM_ADMINISTRATOR' },
    permissions: { reviewApplications: true, finalApproval: true, verifyPayments: true, manageEvents: true },
    kpis: { activeMembers: 124, applicationsNeedingReview: 8, finalApprovals: 2, paymentsToVerify: 4,
      upcomingEvents: 3 },
    charts: {
      membershipActivity: [{ key: '2026-09', label: 'Sep 26', value: 5 }, { key: '2026-10', label: 'Oct 26', value: 7 }],
      membershipDistribution: [{ code: 'ORDINARY', name: 'Ordinary Member', value: 96 },
        { code: 'LIFETIME', name: 'Lifetime Member', value: 28 }],
      applicationPipeline: [{ status: 'SUBMITTED', value: 5 }, { status: 'UNDER_REVIEW', value: 3 },
        { status: 'ADDITIONAL_INFORMATION_REQUIRED', value: 1 }, { status: 'RECOMMENDED_FOR_APPROVAL', value: 2 }],
      applicationActivity: [{ key: '2026-09', label: 'Sep 26', value: 6 }, { key: '2026-10', label: 'Oct 26', value: 9 }],
      paymentStatus: [{ status: 'SUBMITTED', value: 3 }, { status: 'UNDER_VERIFICATION', value: 1 },
        { status: 'VERIFIED', value: 12 }, { status: 'REJECTED', value: 1 }],
    },
    attention: [{ kind: 'APPLICATION', id: 'application-id', reference: 'MYAIS-APP-2026-000041',
      personName: 'Aisyah Rahman', status: 'RECOMMENDED_FOR_APPROVAL', waitingSince: '2026-10-05T04:00:00.000Z',
      waitingLabel: 'Waiting 6 days', href: '/admin/applications/application-id' }],
    upcomingEvents: [{ id: 'event-id', eventNumber: 'MYAIS-EVT-2026-0003', title: 'MyAIS Research Forum',
      startDate: '2026-10-20', startTime: '09:00', venueType: 'PHYSICAL', venueName: 'Kuala Lumpur' }],
    recentActivity: [{ action: 'APPLICATION_APPROVE', label: 'Membership application approved',
      entityType: 'MembershipApplication', reference: 'MYAIS-APP-2026-000040', actorName: 'President Person',
      createdAt: '2026-10-10T04:00:00.000Z' }],
    operationalInsights: { membershipsExpiringSoon: 12, windowDays: 30 },
  };
}

beforeEach(() => fixture.getAdminDashboard.mockReset().mockResolvedValue(systemDashboard()));
afterEach(cleanup);

describe('admin command dashboard', () => {
  it('renders the role, canonical KPI values, real chart values, links and operational panels', async () => {
    render(<AdminCommandDashboard />);
    expect(await screen.findByText('Dr. Hapini', { exact: false })).toBeTruthy();
    expect(screen.getByText('System Administrator')).toBeTruthy();
    expect(screen.getByText('124')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Applications needing review/ }).getAttribute('href')).toBe('/admin/applications');
    expect(screen.getByRole('link', { name: /Final approval/ }).getAttribute('href'))
      .toBe('/admin/applications?status=RECOMMENDED_FOR_APPROVAL');
    expect(screen.getByRole('heading', { name: 'Membership activations' })).toBeTruthy();
    expect(screen.getByText('Sep 26: 5, Oct 26: 7')).toBeTruthy();
    expect(screen.getByText('Ordinary Member: 96, Lifetime Member: 28')).toBeTruthy();
    expect(screen.getByRole('link', { name: /MYAIS-APP-2026-000041/ }).getAttribute('href'))
      .toBe('/admin/applications/application-id');
    expect(screen.getByText('Waiting 6 days')).toBeTruthy();
    expect(screen.getByRole('link', { name: /MyAIS Research Forum/ }).getAttribute('href')).toBe('/admin/events/event-id');
    expect(screen.getByText('Membership application approved')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Create event/ })).toBeTruthy();
  });

  it('shows role-safe Treasurer content without application analytics or actions', async () => {
    const data = systemDashboard();
    data.viewer = { displayName: 'Treasurer Person', role: 'TREASURER' };
    data.permissions = { reviewApplications: false, finalApproval: false, verifyPayments: true, manageEvents: false };
    data.kpis = { activeMembers: 124, upcomingEvents: 3, paymentsToVerify: 4 };
    data.charts = { paymentStatus: data.charts.paymentStatus };
    data.attention = [{ kind: 'PAYMENT', id: 'payment-id', reference: 'MYAIS-PAY-2026-000004',
      personName: 'Member Person', status: 'SUBMITTED', amount: '150', currency: 'MYR',
      waitingSince: '2026-10-10T04:00:00.000Z', waitingLabel: 'Waiting 1 day', href: '/admin/payments/payment-id' }];
    fixture.getAdminDashboard.mockResolvedValue(data);
    render(<AdminCommandDashboard />);
    expect(await screen.findByText('Treasurer')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Payment verification status' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Application pipeline' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Application queue/ })).toBeNull();
    expect(screen.getByRole('link', { name: /MYAIS-PAY-2026-000004/ })).toBeTruthy();
  });

  it('uses compact truthful zero states instead of empty chart drawings', async () => {
    const data = systemDashboard();
    data.charts.membershipActivity = data.charts.membershipActivity?.map(item => ({ ...item, value: 0 }));
    data.charts.applicationPipeline = data.charts.applicationPipeline?.map(item => ({ ...item, value: 0 }));
    data.attention = []; data.upcomingEvents = []; data.recentActivity = [];
    fixture.getAdminDashboard.mockResolvedValue(data);
    render(<AdminCommandDashboard />);
    const emptyMembership = await screen.findByText('No memberships were activated in this period.');
    expect(emptyMembership.closest('.admin-chart-card')?.classList.contains('is-empty')).toBe(true);
    expect(screen.getByText('No applications are in the active pipeline.')).toBeTruthy();
    expect(screen.getByText("You're all caught up.")).toBeTruthy();
    expect(screen.getByText('No upcoming events')).toBeTruthy();
    expect(screen.getByText('No recent activity')).toBeTruthy();
  });

  it('shows a skeleton and offers a recoverable retry without leaking errors', async () => {
    let reject!: (error: Error) => void;
    fixture.getAdminDashboard.mockReturnValueOnce(new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
    render(<AdminCommandDashboard />);
    expect(screen.getByRole('status', { name: 'Loading administration dashboard' })).toBeTruthy();
    reject(new Error('private database details'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    fixture.getAdminDashboard.mockResolvedValueOnce(systemDashboard());
    await userEvent.setup().click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(fixture.getAdminDashboard).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Dr. Hapini', { exact: false })).toBeTruthy();
    expect(document.body.textContent).not.toContain('private database details');
  });

  it('keeps tablet and phone layouts responsive without table overflow', () => {
    const styles = readFileSync('app/globals.css', 'utf8');
    expect(styles).toContain('@media (max-width: 920px)');
    expect(styles).toContain('.admin-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }');
    expect(styles).toContain('@media (max-width: 620px)');
    expect(styles).toContain('.admin-kpi-grid, .admin-chart-grid, .admin-chart-grid-primary, .admin-operations-grid { grid-template-columns: 1fr; }');
  });
});

describe('admin dashboard API client', () => {
  it('uses the dedicated authenticated dashboard route', async () => {
    const fetcher = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
      async () => new Response('{}', { status: 200 }));
    const api = new ApiClient('https://api.example.test', async () => 'token', fetcher as typeof fetch);
    await api.getAdminDashboard();
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.example.test/admin/dashboard');
    expect((fetcher.mock.calls[0]?.[1]?.headers as Headers).get('authorization')).toBe('Bearer token');
  });
});
