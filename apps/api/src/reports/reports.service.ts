import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@myais/database';
import { reportQuerySchema, reportTypeSchema, type ReportType } from '@myais/validation';
import ExcelJS from 'exceljs';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';

type Cell = string | number | boolean | Date | null;
interface Table { name: string; headers: string[]; rows: Cell[][] }
const allReportRoles = ['SYSTEM_ADMINISTRATOR', 'PRESIDENT'] as const;
const secretariatReports: ReportType[] = ['member-directory', 'membership', 'application', 'event'];

function safeCell(value: Cell): Cell {
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return `'${value}`;
  return value;
}
function csvCell(value: Cell): string { const text = value instanceof Date ? value.toISOString() : String(safeCell(value) ?? '');
  return `"${text.replaceAll('"', '""')}"`; }
type ReportDateKind = 'calendar-date' | 'malaysia-instant';

function nextCalendarDay(value: string): string {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function reportBoundary(value: string, kind: ReportDateKind): Date {
  return new Date(`${value}T00:00:00.000${kind === 'malaysia-instant' ? '+08:00' : 'Z'}`);
}

function dateRange(field: string, from: string | undefined, to: string | undefined,
  kind: ReportDateKind): Record<string, unknown> {
  if (!from && !to) return {};
  return { [field]: { ...(from ? { gte: reportBoundary(from, kind) } : {}),
    ...(to ? { lt: reportBoundary(nextCalendarDay(to), kind) } : {}) } };
}

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async export(actor: CanonicalPrincipal, typeInput: string, queryInput: unknown) {
    const typeResult = reportTypeSchema.safeParse(typeInput); const queryResult = reportQuerySchema.safeParse(queryInput);
    if (!typeResult.success || !queryResult.success) throw new BadRequestException('Invalid report request');
    const type = typeResult.data; const query = queryResult.data; this.authorize(actor.role, type); this.validateFilters(type, query);
    const table = await this.table(type, query); const data = query.format === 'csv' ? this.csv(table) : await this.xlsx(table);
    await this.prisma.client.auditLog.create({ data: { actorUserId: actor.id, actorName: actor.fullName || actor.email,
      action: 'REPORT_EXPORTED', entityType: 'Report',
      description: `Exported ${type} report as ${query.format.toUpperCase()}` } });
    return { data, filename: `myais-${type}-${new Date().toISOString().slice(0, 10)}.${query.format}`,
      contentType: query.format === 'csv' ? 'text/csv; charset=utf-8' :
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }
  private authorize(role: string | null, type: ReportType) {
    if (role && allReportRoles.includes(role as (typeof allReportRoles)[number])) return;
    if ((role === 'SECRETARY' || role === 'ASSISTANT_SECRETARY') && secretariatReports.includes(type)) return;
    if (role === 'TREASURER' && type === 'payment') return;
    throw new ForbiddenException('This role cannot export the requested report');
  }
  private validateFilters(type: ReportType, query: { status?: string; membershipType?: string }) {
    const statuses: Record<ReportType, readonly string[]> = {
      'member-directory': ['ACTIVE', 'INACTIVE'], membership: ['PENDING', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'TERMINATED'],
      application: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ADDITIONAL_INFORMATION_REQUIRED', 'ELIGIBLE',
        'RECOMMENDED_FOR_APPROVAL', 'APPROVED_PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAYMENT_UNDER_VERIFICATION',
        'ACTIVE', 'REJECTED', 'EXPIRED', 'SUSPENDED', 'TERMINATED'],
      payment: ['NOT_SUBMITTED', 'SUBMITTED', 'UNDER_VERIFICATION', 'VERIFIED', 'REJECTED'],
      event: ['DRAFT', 'PUBLISHED', 'REGISTRATION_CLOSED', 'CANCELLED', 'COMPLETED', 'ARCHIVED'],
    };
    if (query.status && !statuses[type].includes(query.status)) throw new BadRequestException('Invalid status filter');
    if (query.membershipType && !['ORDINARY', 'LIFETIME', 'ASSOCIATE', 'HONORARY'].includes(query.membershipType)) {
      throw new BadRequestException('Invalid membership type filter');
    }
  }
  private async table(type: ReportType, query: { status?: string; membershipType?: string; from?: string; to?: string }): Promise<Table> {
    switch (type) {
      case 'member-directory': return this.members(query);
      case 'membership': return this.memberships(query);
      case 'application': return this.applications(query);
      case 'payment': return this.payments(query);
      case 'event': return this.events(query);
    }
  }
  private async members(query: { status?: string; membershipType?: string; from?: string; to?: string }): Promise<Table> {
    const where: Prisma.UserWhereInput = {};
    if (query.status === 'INACTIVE') where.NOT = { membershipRecordsByUser: { some: { status: 'ACTIVE' } } };
    if (query.membershipType || query.from || query.to) where.membershipRecordsByUser = { some: {
      ...(query.status === 'ACTIVE' ? { status: 'ACTIVE' as const } : {}),
      ...(query.membershipType ? { membershipType: { code: query.membershipType as never } } : {}),
      ...dateRange('startDate', query.from, query.to, 'calendar-date') } };
    else if (query.status === 'ACTIVE') where.membershipRecordsByUser = { some: { status: 'ACTIVE' } };
    const rows = await this.prisma.client.user.findMany({ where, orderBy: { fullName: 'asc' }, select: { fullName: true,
      email: true, phoneNumber: true, role: true, accountStatus: true, memberProfileByUser: { select: { institution: true,
        occupation: true } } } });
    return { name: 'Member Directory', headers: ['Name', 'Email', 'Phone', 'Institution', 'Occupation', 'Role', 'Account status'],
      rows: rows.map(row => [row.fullName, row.email, row.phoneNumber, row.memberProfileByUser?.institution ?? null,
        row.memberProfileByUser?.occupation ?? null, row.role, row.accountStatus]) };
  }
  private async memberships(query: { status?: string; membershipType?: string; from?: string; to?: string }): Promise<Table> {
    const rows = await this.prisma.client.membership.findMany({ where: { ...(query.status ? { status: query.status as never } : {}),
      ...(query.membershipType ? { membershipType: { code: query.membershipType as never } } : {}),
      ...dateRange('startDate', query.from, query.to, 'calendar-date') }, orderBy: { startDate: 'desc' }, select: { membershipNumber: true,
      membershipTypeName: true, status: true, startDate: true, expiryDate: true, votingEligible: true,
      user: { select: { fullName: true, email: true } }, membershipType: { select: { name: true } } } });
    return { name: 'Memberships', headers: ['Membership number', 'Name', 'Email', 'Type', 'Status', 'Start date', 'Expiry date', 'Voting eligible'],
      rows: rows.map(row => [row.membershipNumber, row.user.fullName, row.user.email, row.membershipTypeName ?? row.membershipType.name,
        row.status, row.startDate, row.expiryDate, row.votingEligible]) };
  }
  private async applications(query: { status?: string; membershipType?: string; from?: string; to?: string }): Promise<Table> {
    const rows = await this.prisma.client.membershipApplication.findMany({ where: { ...(query.status ? { status: query.status as never } : {}),
      ...(query.membershipType ? { requestedMembershipType: { code: query.membershipType as never } } : {}),
      ...dateRange('submittedAt', query.from, query.to, 'malaysia-instant') }, orderBy: { submittedAt: 'desc' }, select: { applicationNumber: true,
      status: true, requestedMembershipTypeCode: true, recommendedMembershipTypeCode: true, approvedMembershipTypeCode: true,
      submittedAt: true, reviewedAt: true, approvedAt: true, rejectedAt: true, user: { select: { fullName: true, email: true } } } });
    return { name: 'Applications', headers: ['Application number', 'Name', 'Email', 'Requested type', 'Recommended type', 'Approved type',
      'Status', 'Submitted', 'Reviewed', 'Approved', 'Rejected'], rows: rows.map(row => [row.applicationNumber, row.user.fullName,
      row.user.email, row.requestedMembershipTypeCode, row.recommendedMembershipTypeCode, row.approvedMembershipTypeCode, row.status,
      row.submittedAt, row.reviewedAt, row.approvedAt, row.rejectedAt]) };
  }
  private async payments(query: { status?: string; from?: string; to?: string }): Promise<Table> {
    const dateField = query.status === 'VERIFIED' ? 'verifiedAt' : 'submittedAt';
    const rows = await this.prisma.client.payment.findMany({ where: { ...(query.status ? { status: query.status as never } : {}),
      ...dateRange(dateField, query.from, query.to, 'malaysia-instant') }, orderBy: { submittedAt: 'desc' }, select: { paymentReference: true,
      totalAmount: true, currency: true, status: true, paymentMethod: true, submittedAt: true, verifiedAt: true,
      user: { select: { fullName: true, email: true } }, application: { select: { applicationNumber: true } } } });
    return { name: 'Payments', headers: ['Payment reference', 'Name', 'Email', 'Application number', 'Amount', 'Currency', 'Status',
      'Method', 'Submitted', 'Verified'], rows: rows.map(row => [row.paymentReference, row.user.fullName, row.user.email,
      row.application?.applicationNumber ?? null, row.totalAmount.toString(), row.currency, row.status, row.paymentMethod,
      row.submittedAt, row.verifiedAt]) };
  }
  private async events(query: { status?: string; from?: string; to?: string }): Promise<Table> {
    const rows = await this.prisma.client.event.findMany({ where: { ...(query.status ? { status: query.status as never } : {}),
      ...dateRange('startDate', query.from, query.to, 'calendar-date') }, orderBy: { startDate: 'desc' }, select: { eventNumber: true, title: true,
      category: true, status: true, venueType: true, startDate: true, startTime: true, endDate: true, publishedAt: true } });
    return { name: 'Events', headers: ['Event number', 'Title', 'Category', 'Status', 'Venue type', 'Start date', 'Start time', 'End date',
      'Published'], rows: rows.map(row => [row.eventNumber, row.title, row.category, row.status, row.venueType, row.startDate,
      row.startTime, row.endDate, row.publishedAt]) };
  }
  private csv(table: Table): Buffer { const lines = [table.headers.map(csvCell).join(','),
    ...table.rows.map(row => row.map(csvCell).join(','))]; return Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8'); }
  private async xlsx(table: Table): Promise<Buffer> { const workbook = new ExcelJS.Workbook(); workbook.creator = 'MyAIS Connect';
    const sheet = workbook.addWorksheet(table.name.slice(0, 31)); sheet.addRow(table.headers); sheet.getRow(1).font = { bold: true };
    for (const row of table.rows) sheet.addRow(row.map(safeCell)); sheet.columns.forEach(column => { column.width = Math.min(40,
      Math.max(12, ...(column.values ?? []).map(value => String(value ?? '').length + 2))); });
    const output = await workbook.xlsx.writeBuffer(); return Buffer.from(output); }
}
