import { Inject, Injectable } from '@nestjs/common';
import { UserRole, type Prisma } from '@myais/database';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';

const reviewerRoles: UserRole[] = [
  UserRole.PRESIDENT, UserRole.DEPUTY_PRESIDENT, UserRole.SECRETARY, UserRole.ASSISTANT_SECRETARY,
  UserRole.COMMITTEE_MEMBER, UserRole.SYSTEM_ADMINISTRATOR,
];
const finalApproverRoles: UserRole[] = [UserRole.PRESIDENT, UserRole.SYSTEM_ADMINISTRATOR];
const paymentRoles: UserRole[] = [UserRole.TREASURER, UserRole.SYSTEM_ADMINISTRATOR];
const eventManagerRoles: UserRole[] = [
  UserRole.PRESIDENT, UserRole.DEPUTY_PRESIDENT, UserRole.SECRETARY, UserRole.ASSISTANT_SECRETARY,
  UserRole.SYSTEM_ADMINISTRATOR,
];
const fullMembershipAnalyticsRoles: UserRole[] = [
  UserRole.PRESIDENT, UserRole.DEPUTY_PRESIDENT, UserRole.SECRETARY, UserRole.ASSISTANT_SECRETARY,
  UserRole.SYSTEM_ADMINISTRATOR,
];
const pipelineStatuses = [
  'SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFORMATION_REQUIRED', 'RECOMMENDED_FOR_APPROVAL',
] as const;
const paymentStatuses = ['SUBMITTED', 'UNDER_VERIFICATION', 'VERIFIED', 'REJECTED'] as const;

const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
});
const businessMonthFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit',
});

function businessParts(value: Date): { year: number; month: number; day: number } {
  const parts = businessDateFormatter.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(item => item.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}

function businessDate(value: Date): string {
  const { year, month, day } = businessParts(value);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthKey(value: Date): string {
  const parts = businessMonthFormatter.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}`;
}

function monthSeries(now: Date, length: number): Array<{ key: string; label: string }> {
  const current = businessParts(now);
  return Array.from({ length }, (_, index) => {
    const date = new Date(Date.UTC(current.year, current.month - length + index, 1));
    return { key: date.toISOString().slice(0, 7), label: new Intl.DateTimeFormat('en-MY', {
      month: 'short', year: '2-digit', timeZone: 'UTC',
    }).format(date) };
  });
}

function businessMonthStartUtc(key: string): Date {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, 1, -8));
}

function displayName(user: { fullName: string | null; legacyFullName: string | null }): string {
  return user.fullName?.trim() || user.legacyFullName?.trim() || 'Applicant';
}

function safeActorName(value: string | null): string | null {
  const name = value?.trim();
  return name && !name.includes('@') ? name : null;
}

function auditLabel(action: string): string {
  const labels: Record<string, string> = {
    APPLICATION_SUBMITTED: 'Application submitted', APPLICATION_START_REVIEW: 'Application review started',
    APPLICATION_REQUEST_INFORMATION: 'Additional information requested',
    APPLICATION_RECOMMEND_APPROVAL: 'Application recommended for approval',
    APPLICATION_APPROVE: 'Membership application approved', APPLICATION_REJECT: 'Application rejected',
    PAYMENT_SUBMITTED: 'Payment evidence submitted', PAYMENT_VERIFY: 'Payment verified', PAYMENT_REJECT: 'Payment rejected',
    EVENT_CREATED: 'Event created', EVENT_UPDATED: 'Event updated', EVENT_PUBLISHED: 'Event published',
    EVENT_CANCELLED: 'Event cancelled',
  };
  return labels[action] ?? action.toLowerCase().replace(/_/g, ' ').replace(/^./, value => value.toUpperCase());
}

function safeReference(description: string): string | null {
  return description.match(/MYAIS-(?:APP|PAY|EVT)-\d{4}-\d+/)?.[0] ?? null;
}

function waitingLabel(from: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000));
  if (minutes < 60) return `Waiting ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Waiting ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.floor(hours / 24);
  return `Waiting ${days} ${days === 1 ? 'day' : 'days'}`;
}

@Injectable()
export class AdminDashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(viewer: CanonicalPrincipal, now = new Date()) {
    const role = viewer.role!;
    const canReview = reviewerRoles.includes(role);
    const canFinallyApprove = finalApproverRoles.includes(role);
    const canVerifyPayments = paymentRoles.includes(role);
    const canManageEvents = eventManagerRoles.includes(role);
    const hasFullMembershipAnalytics = fullMembershipAnalyticsRoles.includes(role);
    const months12 = monthSeries(now, 12);
    const months6 = months12.slice(-6);
    const today = new Date(`${businessDate(now)}T00:00:00.000Z`);
    const expiryLimit = new Date(today); expiryLimit.setUTCDate(expiryLimit.getUTCDate() + 30);

    const activeMembershipsPromise = this.prisma.client.membership.findMany({
      where: { status: 'ACTIVE' },
      distinct: ['userId'],
      orderBy: [{ userId: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: { userId: true, activatedAt: true, expiryDate: true, membershipTypeCode: true, membershipTypeName: true,
        membershipType: { select: { code: true, name: true } } },
    });
    const upcomingWhere: Prisma.EventWhereInput = { status: 'PUBLISHED', startDate: { gte: today } };
    const [activeMemberships, upcomingEvents, upcomingEventCount, audits] = await Promise.all([
      activeMembershipsPromise,
      this.prisma.client.event.findMany({ where: upcomingWhere,
        orderBy: [{ startDate: 'asc' }, { startTime: 'asc' }, { id: 'asc' }], take: 3,
        select: { id: true, eventNumber: true, title: true, startDate: true, startTime: true,
          venueType: true, venueName: true } }),
      this.prisma.client.event.count({ where: upcomingWhere }),
      this.recentAudits(role),
    ]);

    const kpis: Record<string, number> = { activeMembers: activeMemberships.length, upcomingEvents: upcomingEventCount };
    const charts: Record<string, unknown> = {};
    let attention: Array<Record<string, unknown>> = [];
    let applicationAttention: Array<Record<string, unknown>> = [];
    let paymentAttention: Array<Record<string, unknown>> = [];

    const distribution = new Map<string, { code: string; name: string; value: number }>();
    for (const membership of activeMemberships) {
      const code = membership.membershipTypeCode ?? membership.membershipType.code;
      const name = membership.membershipTypeName ?? membership.membershipType.name;
      const current = distribution.get(code);
      distribution.set(code, { code, name, value: (current?.value ?? 0) + 1 });
    }
    if (role === UserRole.COMMITTEE_MEMBER || hasFullMembershipAnalytics) {
      charts.membershipDistribution = [...distribution.values()].sort((left, right) => right.value - left.value ||
        left.name.localeCompare(right.name));
    }
    if (hasFullMembershipAnalytics) {
      const activations = await this.prisma.client.membership.findMany({
        where: { activatedAt: { gte: businessMonthStartUtc(months12[0]!.key), lte: now } },
        select: { userId: true, activatedAt: true },
      });
      const totals = new Map(months12.map(month => [month.key, new Set<string>()]));
      for (const record of activations) if (record.activatedAt) totals.get(monthKey(record.activatedAt))?.add(record.userId);
      charts.membershipActivity = months12.map(month => ({ ...month, value: totals.get(month.key)?.size ?? 0 }));
    }

    if (canReview) {
      const [pipeline, submittedApplications] = await Promise.all([
        this.prisma.client.membershipApplication.groupBy({ by: ['status'], where: {
          status: { in: [...pipelineStatuses] }, userId: { not: viewer.id },
        },
          _count: { _all: true } }),
        this.prisma.client.membershipApplication.findMany({
          where: { submittedAt: { gte: businessMonthStartUtc(months6[0]!.key), lte: now } },
          select: { id: true, submittedAt: true },
        }),
      ]);
      const pipelineCounts = new Map(pipeline.map(item => [item.status, item._count._all]));
      kpis.applicationsNeedingReview = (pipelineCounts.get('SUBMITTED') ?? 0) + (pipelineCounts.get('UNDER_REVIEW') ?? 0);
      if (canFinallyApprove) kpis.finalApprovals = pipelineCounts.get('RECOMMENDED_FOR_APPROVAL') ?? 0;
      charts.applicationPipeline = pipelineStatuses.map(status => ({ status, value: pipelineCounts.get(status) ?? 0 }));
      const activityTotals = new Map(months6.map(month => [month.key, 0]));
      for (const application of submittedApplications) if (application.submittedAt) {
        const key = monthKey(application.submittedAt); activityTotals.set(key, (activityTotals.get(key) ?? 0) + 1);
      }
      charts.applicationActivity = months6.map(month => ({ ...month, value: activityTotals.get(month.key) ?? 0 }));
      applicationAttention = await this.applicationAttention(viewer.id, canFinallyApprove, now);
    }

    if (canVerifyPayments) {
      const workload = await this.prisma.client.payment.groupBy({ by: ['status'],
        where: { status: { in: [...paymentStatuses] }, userId: { not: viewer.id } }, _count: { _all: true } });
      const paymentCounts = new Map(workload.map(item => [item.status, item._count._all]));
      kpis.paymentsToVerify = (paymentCounts.get('SUBMITTED') ?? 0) + (paymentCounts.get('UNDER_VERIFICATION') ?? 0);
      charts.paymentStatus = paymentStatuses.map(status => ({ status, value: paymentCounts.get(status) ?? 0 }));
      paymentAttention = await this.paymentAttention(viewer.id, now);
    }

    if (applicationAttention.length > 0 && paymentAttention.length > 0) {
      attention = [...applicationAttention, ...paymentAttention].sort((left, right) => {
        const leftPriority = left.status === 'RECOMMENDED_FOR_APPROVAL' ? 0 : 1;
        const rightPriority = right.status === 'RECOMMENDED_FOR_APPROVAL' ? 0 : 1;
        return leftPriority - rightPriority || String(left.waitingSince).localeCompare(String(right.waitingSince));
      }).slice(0, 5);
    } else {
      attention = applicationAttention.length > 0 ? applicationAttention : paymentAttention;
    }

    const expiringSoon = activeMemberships.filter(record => record.expiryDate && record.expiryDate >= today &&
      record.expiryDate <= expiryLimit).length;
    return {
      viewer: { displayName: viewer.fullName?.trim() || 'MyAIS administrator', role },
      permissions: { reviewApplications: canReview, finalApproval: canFinallyApprove,
        verifyPayments: canVerifyPayments, manageEvents: canManageEvents },
      kpis,
      charts,
      attention,
      upcomingEvents: upcomingEvents.map(event => ({ ...event, startDate: event.startDate.toISOString().slice(0, 10) })),
      recentActivity: audits.map(audit => ({ action: audit.action, label: auditLabel(audit.action),
        entityType: audit.entityType, reference: safeReference(audit.description), actorName: safeActorName(audit.actorName),
        createdAt: audit.createdAt.toISOString() })),
      operationalInsights: { membershipsExpiringSoon: expiringSoon, windowDays: 30 },
    };
  }

  private async applicationAttention(viewerId: string, finalApproval: boolean, now: Date) {
    const select = { id: true, applicationNumber: true, status: true, submittedAt: true, reviewedAt: true,
      updatedAt: true, user: { select: { fullName: true, legacyFullName: true } } } as const;
    const finalRows = finalApproval ? await this.prisma.client.membershipApplication.findMany({
      where: { status: 'RECOMMENDED_FOR_APPROVAL', userId: { not: viewerId } },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }], take: 5, select,
    }) : [];
    const reviewRows = finalRows.length < 5 ? await this.prisma.client.membershipApplication.findMany({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }, userId: { not: viewerId } },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }], take: 5 - finalRows.length, select,
    }) : [];
    return [...finalRows, ...reviewRows].map(row => {
      const since = (row.status === 'SUBMITTED' ? row.submittedAt : row.status === 'UNDER_REVIEW' ? row.reviewedAt :
        row.updatedAt) ?? row.updatedAt;
      return { kind: 'APPLICATION', id: row.id, reference: row.applicationNumber,
        personName: displayName(row.user), status: row.status, waitingSince: since.toISOString(),
        waitingLabel: waitingLabel(since, now), href: `/admin/applications/${row.id}` };
    });
  }

  private async paymentAttention(viewerId: string, now: Date) {
    const rows = await this.prisma.client.payment.findMany({
      where: { status: { in: ['SUBMITTED', 'UNDER_VERIFICATION'] }, userId: { not: viewerId } },
      orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }], take: 5,
      select: { id: true, paymentReference: true, status: true, totalAmount: true, currency: true,
        submittedAt: true, createdAt: true, application: { select: { applicationNumber: true } },
        user: { select: { fullName: true, legacyFullName: true } } },
    });
    return rows.map(row => {
      const since = row.submittedAt ?? row.createdAt;
      return { kind: 'PAYMENT', id: row.id, reference: row.paymentReference ?? row.application?.applicationNumber,
        personName: displayName(row.user), status: row.status, amount: row.totalAmount.toString(),
        currency: row.currency ?? 'MYR', waitingSince: since.toISOString(), waitingLabel: waitingLabel(since, now),
        href: `/admin/payments/${row.id}` };
    });
  }

  private recentAudits(role: UserRole) {
    const actions = paymentRoles.includes(role) && role !== UserRole.SYSTEM_ADMINISTRATOR
      ? ['PAYMENT_SUBMITTED', 'PAYMENT_VERIFY', 'PAYMENT_REJECT']
      : role === UserRole.SYSTEM_ADMINISTRATOR
        ? ['APPLICATION_SUBMITTED', 'APPLICATION_START_REVIEW', 'APPLICATION_REQUEST_INFORMATION',
          'APPLICATION_RECOMMEND_APPROVAL', 'APPLICATION_APPROVE', 'APPLICATION_REJECT',
          'PAYMENT_SUBMITTED', 'PAYMENT_VERIFY', 'PAYMENT_REJECT', 'EVENT_CREATED', 'EVENT_UPDATED',
          'EVENT_PUBLISHED', 'EVENT_CANCELLED']
        : ['APPLICATION_SUBMITTED', 'APPLICATION_START_REVIEW', 'APPLICATION_REQUEST_INFORMATION',
          'APPLICATION_RECOMMEND_APPROVAL', 'APPLICATION_APPROVE', 'APPLICATION_REJECT',
          ...(eventManagerRoles.includes(role) ? ['EVENT_CREATED', 'EVENT_UPDATED', 'EVENT_PUBLISHED', 'EVENT_CANCELLED'] : [])];
    return this.prisma.client.auditLog.findMany({ where: { action: { in: actions } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 5, select: { action: true, entityType: true, actorName: true, description: true, createdAt: true } });
  }
}
