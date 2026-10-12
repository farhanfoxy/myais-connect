import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@myais/database';
import { adminAnnouncementQuerySchema, announcementInputSchema, uuidPathSchema,
  type AnnouncementInput } from '@myais/validation';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';

const committeeRoles = ['PRESIDENT', 'DEPUTY_PRESIDENT', 'SECRETARY', 'ASSISTANT_SECRETARY', 'TREASURER',
  'COMMITTEE_MEMBER', 'SYSTEM_ADMINISTRATOR'] as const;
const memberRoles = ['ORDINARY_MEMBER', 'LIFETIME_MEMBER', 'ASSOCIATE_MEMBER', 'HONORARY_MEMBER'] as const;
const select = { id: true, title: true, category: true, summary: true, content: true, targetAudience: true,
  status: true, publishAt: true, expiryAt: true, createdByName: true, createdAt: true, updatedAt: true } satisfies Prisma.AnnouncementSelect;
type Record = Prisma.AnnouncementGetPayload<{ select: typeof select }>;

function safe(record: Record) { const { publishAt, expiryAt, ...rest } = record; return { ...rest, publishedAt: publishAt?.toISOString() ?? null,
  expiresAt: expiryAt?.toISOString() ?? null,
  createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() }; }

@Injectable()
export class AnnouncementsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private audience(user: CanonicalPrincipal) {
    const result: Array<'ALL' | 'MEMBERS' | 'APPLICANTS' | 'COMMITTEE'> = ['ALL'];
    if (user.role === 'APPLICANT') result.push('APPLICANTS');
    if (user.role && memberRoles.includes(user.role as (typeof memberRoles)[number])) result.push('MEMBERS');
    if (user.role && committeeRoles.includes(user.role as (typeof committeeRoles)[number])) result.push('COMMITTEE');
    return result;
  }
  async memberList(user: CanonicalPrincipal) {
    const now = new Date();
    const records = await this.prisma.client.announcement.findMany({ where: { status: 'PUBLISHED',
      targetAudience: { in: this.audience(user) }, AND: [{ OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
        { OR: [{ expiryAt: null }, { expiryAt: { gt: now } }] }] }, orderBy: [{ publishAt: 'desc' }, { createdAt: 'desc' }],
      select });
    return records.map(safe);
  }
  async memberDetail(user: CanonicalPrincipal, input: string) {
    const id = this.id(input); const now = new Date();
    const record = await this.prisma.client.announcement.findFirst({ where: { id, status: 'PUBLISHED',
      targetAudience: { in: this.audience(user) }, AND: [{ OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
        { OR: [{ expiryAt: null }, { expiryAt: { gt: now } }] }] }, select });
    if (!record) throw new NotFoundException('Announcement not found'); return safe(record);
  }
  async adminList(input: unknown) {
    const parsed = adminAnnouncementQuerySchema.safeParse(input); if (!parsed.success) throw new BadRequestException('Invalid query');
    const { page, pageSize, status, search } = parsed.data; const where: Prisma.AnnouncementWhereInput = {};
    if (status !== 'ALL') where.status = status; if (search) where.OR = [{ title: { contains: search, mode: 'insensitive' } },
      { summary: { contains: search, mode: 'insensitive' } }];
    const [items, total] = await this.prisma.client.$transaction([this.prisma.client.announcement.findMany({ where,
      orderBy: [{ createdAt: 'desc' }], skip: (page - 1) * pageSize, take: pageSize, select }),
      this.prisma.client.announcement.count({ where })]);
    return { items: items.map(safe), page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }
  async adminDetail(input: string) { const record = await this.prisma.client.announcement.findUnique({ where: { id: this.id(input) }, select });
    if (!record) throw new NotFoundException('Announcement not found'); return safe(record); }
  async create(actor: CanonicalPrincipal, input: unknown) {
    const data = this.parse(input); return this.prisma.client.$transaction(async tx => { const record = await tx.announcement.create({
      data: { ...data, expiryAt: data.expiryAt ? new Date(data.expiryAt) : null, status: 'DRAFT', createdByUserId: actor.id,
        createdByName: actor.fullName || actor.email }, select }); await this.audit(tx, actor, 'ANNOUNCEMENT_CREATED', record.id);
      return safe(record); });
  }
  async update(actor: CanonicalPrincipal, inputId: string, input: unknown) { const id = this.id(inputId); const data = this.parse(input);
    return this.prisma.client.$transaction(async tx => { const current = await tx.announcement.findUnique({ where: { id }, select: { status: true } });
      if (!current) throw new NotFoundException('Announcement not found'); if (current.status !== 'DRAFT') throw new ConflictException('Only draft announcements can be edited');
      const record = await tx.announcement.update({ where: { id }, data: { ...data, expiryAt: data.expiryAt ? new Date(data.expiryAt) : null }, select });
      await this.audit(tx, actor, 'ANNOUNCEMENT_UPDATED', id); return safe(record); }); }
  async publish(actor: CanonicalPrincipal, input: string) { const id = this.id(input); return this.prisma.client.$transaction(async tx => {
    const current = await tx.announcement.findUnique({ where: { id }, select }); if (!current) throw new NotFoundException('Announcement not found');
    if (current.status !== 'DRAFT') throw new ConflictException('Only draft announcements can be published'); const now = new Date();
    const record = await tx.announcement.update({ where: { id }, data: { status: 'PUBLISHED', publishAt: now }, select });
    const users = await tx.user.findMany({ where: this.recipientWhere(record.targetAudience ?? 'ALL'), select: { id: true } });
    if (users.length) await tx.notification.createMany({ data: users.map(user => ({ userId: user.id, type: 'ANNOUNCEMENT',
      eventType: 'ANNOUNCEMENT_PUBLISHED', title: 'New announcement', message: record.title,
      relatedEntityType: 'Announcement', actionUrl: `/news/${id}` })) });
    await this.audit(tx, actor, 'ANNOUNCEMENT_PUBLISHED', id); return safe(record); }); }
  async archive(actor: CanonicalPrincipal, input: string) { const id = this.id(input); return this.prisma.client.$transaction(async tx => {
    const current = await tx.announcement.findUnique({ where: { id }, select: { status: true } }); if (!current) throw new NotFoundException('Announcement not found');
    if (current.status !== 'PUBLISHED') throw new ConflictException('Only published announcements can be archived');
    const record = await tx.announcement.update({ where: { id }, data: { status: 'ARCHIVED' }, select });
    await this.audit(tx, actor, 'ANNOUNCEMENT_ARCHIVED', id); return safe(record); }); }
  private recipientWhere(audience: 'ALL' | 'MEMBERS' | 'APPLICANTS' | 'COMMITTEE'): Prisma.UserWhereInput {
    const base: Prisma.UserWhereInput = { accountStatus: 'ACTIVE' }; if (audience === 'ALL') return base;
    if (audience === 'APPLICANTS') return { ...base, role: 'APPLICANT' };
    return { ...base, role: { in: audience === 'MEMBERS' ? [...memberRoles] : [...committeeRoles] } };
  }
  private parse(input: unknown): AnnouncementInput { const parsed = announcementInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException({ message: 'Announcement validation failed', errors: parsed.error.flatten() }); return parsed.data; }
  private id(input: string) { const parsed = uuidPathSchema.safeParse(input); if (!parsed.success) throw new BadRequestException('Invalid announcement ID'); return parsed.data; }
  private audit(tx: Prisma.TransactionClient, actor: CanonicalPrincipal, action: string, id: string) { return tx.auditLog.create({ data: {
    actorUserId: actor.id, actorName: actor.fullName || actor.email, action, entityType: 'Announcement',
    description: `${action.replaceAll('_', ' ').toLowerCase()} (${id})` } }); }
}
