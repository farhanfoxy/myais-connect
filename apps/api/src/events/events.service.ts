import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@myais/database';
import {
  adminEventQuerySchema,
  cancelEventSchema,
  eventInputSchema,
  memberEventQuerySchema,
  uuidPathSchema,
  type EventInput,
} from '@myais/validation';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import { myaisBusinessYear } from '../membership-applications/membership-applications.service.js';

const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
});

function myaisBusinessDate(value: Date): string {
  const parts = businessDateFormatter.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const publicEventSelect = {
  id: true,
  eventNumber: true,
  title: true,
  category: true,
  summary: true,
  description: true,
  coverImage: true,
  speakerName: true,
  speakerTitle: true,
  eventType: true,
  venueType: true,
  venueName: true,
  physicalAddress: true,
  startDate: true,
  startTime: true,
  endDate: true,
  endTime: true,
  registrationStart: true,
  registrationDeadline: true,
  capacity: true,
  limitedSeats: true,
  memberFee: true,
  nonMemberFee: true,
  currency: true,
  paymentInstructions: true,
  registrationUrl: true,
  status: true,
  targetAudience: true,
  publishedAt: true,
  cancellationReason: true,
  placeholderImageNotice: true,
  timezone: true,
} satisfies Prisma.EventSelect;

const adminEventSelect = {
  ...publicEventSelect,
  onlineMeetingUrl: true,
  slug: true,
  createdAt: true,
  updatedAt: true,
  cancelledAt: true,
} satisfies Prisma.EventSelect;

type PublicEventRecord = Prisma.EventGetPayload<{ select: typeof publicEventSelect }>;
type AdminEventRecord = Prisma.EventGetPayload<{ select: typeof adminEventSelect }>;

function dateOnly(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

function cleanOptional(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'event';
}

function eventData(input: EventInput): Omit<Prisma.EventUncheckedCreateInput,
  'eventNumber' | 'slug' | 'createdByUserId'> {
  return {
    title: input.title,
    category: input.category,
    summary: cleanOptional(input.summary),
    description: input.description,
    coverImage: cleanOptional(input.coverImage),
    speakerName: cleanOptional(input.speakerName),
    speakerTitle: cleanOptional(input.speakerTitle),
    eventType: cleanOptional(input.eventType),
    venueType: input.venueType,
    venueName: cleanOptional(input.venueName),
    physicalAddress: cleanOptional(input.physicalAddress),
    onlineMeetingUrl: cleanOptional(input.onlineMeetingUrl),
    startDate: new Date(`${input.startDate}T00:00:00.000Z`),
    startTime: input.startTime,
    endDate: input.endDate ? new Date(`${input.endDate}T00:00:00.000Z`) : null,
    endTime: cleanOptional(input.endTime),
    registrationStart: input.registrationStart ? new Date(`${input.registrationStart}T00:00:00.000Z`) : null,
    registrationDeadline: input.registrationDeadline ? new Date(`${input.registrationDeadline}T00:00:00.000Z`) : null,
    capacity: input.capacity ?? null,
    limitedSeats: input.limitedSeats,
    memberFee: input.memberFee,
    nonMemberFee: input.nonMemberFee,
    currency: input.currency.toUpperCase(),
    paymentInstructions: cleanOptional(input.paymentInstructions),
    registrationUrl: cleanOptional(input.registrationUrl),
    targetAudience: input.targetAudience,
    timezone: 'Asia/Kuala_Lumpur',
  };
}

@Injectable()
export class EventsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async memberList(input: unknown) {
    const parsed = memberEventQuerySchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid event query');
    const { search, category, limit } = parsed.data;
    const where: Prisma.EventWhereInput = {
      status: 'PUBLISHED',
      startDate: { gte: new Date(`${myaisBusinessDate(new Date())}T00:00:00.000Z`) },
    };
    if (category !== 'ALL') where.category = category;
    if (search) where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { summary: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
    const records = await this.prisma.client.event.findMany({
      where,
      orderBy: [{ startDate: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
      take: limit,
      select: publicEventSelect,
    });
    return records.map(record => this.safePublic(record));
  }

  async memberDetail(eventIdInput: string) {
    const id = this.id(eventIdInput);
    const event = await this.prisma.client.event.findFirst({
      where: { id, status: 'PUBLISHED' },
      select: publicEventSelect,
    });
    if (!event) throw new NotFoundException('Event not found');
    return this.safePublic(event);
  }

  async adminList(input: unknown) {
    const parsed = adminEventQuerySchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid admin event query');
    const { page, pageSize, search, category, status } = parsed.data;
    const where: Prisma.EventWhereInput = {};
    if (category !== 'ALL') where.category = category;
    if (status !== 'ALL') where.status = status;
    if (search) where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { eventNumber: { contains: search, mode: 'insensitive' } },
      { summary: { contains: search, mode: 'insensitive' } },
    ];
    const [records, total] = await this.prisma.client.$transaction([
      this.prisma.client.event.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: adminEventSelect,
      }),
      this.prisma.client.event.count({ where }),
    ]);
    return { items: records.map(record => this.safeAdmin(record)), page, pageSize, total,
      totalPages: Math.ceil(total / pageSize) };
  }

  async adminDetail(eventIdInput: string) {
    const id = this.id(eventIdInput);
    const event = await this.prisma.client.event.findUnique({ where: { id }, select: adminEventSelect });
    if (!event) throw new NotFoundException('Event not found');
    return this.safeAdmin(event);
  }

  async create(actor: CanonicalPrincipal, input: unknown) {
    const parsed = eventInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid event input');
    return this.prisma.client.$transaction(async transaction => {
      const now = new Date();
      const eventNumber = await this.nextEventNumber(transaction, myaisBusinessYear(now));
      const created = await transaction.event.create({
        data: { ...eventData(parsed.data), eventNumber, slug: slugify(parsed.data.title), createdByUserId: actor.id,
          status: 'DRAFT' },
        select: adminEventSelect,
      });
      await this.audit(transaction, actor, 'EVENT_CREATED', `Created event ${created.title}`);
      return this.safeAdmin(created);
    });
  }

  async update(actor: CanonicalPrincipal, eventIdInput: string, input: unknown) {
    const id = this.id(eventIdInput);
    const parsed = eventInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid event input');
    return this.prisma.client.$transaction(async transaction => {
      const existing = await transaction.event.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!existing) throw new NotFoundException('Event not found');
      if (existing.status === 'ARCHIVED') throw new ConflictException('Archived events cannot be edited');
      const updated = await transaction.event.update({
        where: { id }, data: { ...eventData(parsed.data), slug: slugify(parsed.data.title) }, select: adminEventSelect,
      });
      await this.audit(transaction, actor, 'EVENT_UPDATED', `Updated event ${updated.title}`);
      return this.safeAdmin(updated);
    });
  }

  publish(actor: CanonicalPrincipal, eventIdInput: string) {
    return this.transition(actor, eventIdInput, 'DRAFT', 'PUBLISHED');
  }

  async cancel(actor: CanonicalPrincipal, eventIdInput: string, input: unknown) {
    const parsed = cancelEventSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid cancellation input');
    return this.transition(actor, eventIdInput, 'PUBLISHED', 'CANCELLED', parsed.data.reason);
  }

  private async transition(actor: CanonicalPrincipal, eventIdInput: string, requiredStatus: 'DRAFT' | 'PUBLISHED',
    nextStatus: 'PUBLISHED' | 'CANCELLED', reason?: string) {
    const id = this.id(eventIdInput);
    return this.prisma.client.$transaction(async transaction => {
      const event = await transaction.event.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!event) throw new NotFoundException('Event not found');
      if (event.status !== requiredStatus) throw new ConflictException(`Only ${requiredStatus.toLowerCase()} events can be ${nextStatus.toLowerCase()}`);
      const now = new Date();
      const updated = await transaction.event.update({
        where: { id },
        data: nextStatus === 'PUBLISHED' ? { status: nextStatus, publishedAt: now } :
          { status: nextStatus, cancelledAt: now, cancellationReason: reason },
        select: adminEventSelect,
      });
      if (nextStatus === 'PUBLISHED') {
        const memberRoles = ['ORDINARY_MEMBER', 'LIFETIME_MEMBER', 'ASSOCIATE_MEMBER', 'HONORARY_MEMBER'] as const;
        const audience = updated.targetAudience ?? 'MEMBERS_AND_NON_MEMBERS';
        const users = await transaction.user.findMany({ where: { accountStatus: 'ACTIVE', ...(audience === 'MEMBERS' ?
          { role: { in: [...memberRoles] } } : audience === 'NON_MEMBERS' ? { role: 'APPLICANT' } : {}) }, select: { id: true } });
        if (users.length) await transaction.notification.createMany({ data: users.map(user => ({ userId: user.id, type: 'SYSTEM',
          eventType: 'EVENT_PUBLISHED', title: 'New event published', message: updated.title,
          relatedEntityType: 'Event', actionUrl: `/events/${updated.id}` })) });
      }
      await this.audit(transaction, actor, `EVENT_${nextStatus}`, `Changed event status to ${nextStatus}`);
      return this.safeAdmin(updated);
    });
  }

  private async nextEventNumber(transaction: Prisma.TransactionClient, year: number): Promise<string> {
    const prefix = `MYAIS-EVT-${year}-`;
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${prefix}, 7))::text AS "lock"`;
    const records = await transaction.event.findMany({
      where: { eventNumber: { startsWith: prefix } }, select: { eventNumber: true },
    });
    let highest = 0;
    for (const record of records) {
      const match = record.eventNumber?.match(new RegExp(`^${prefix}(\\d{4})$`));
      if (match?.[1]) highest = Math.max(highest, Number(match[1]));
    }
    if (highest >= 9999) throw new ConflictException('Event number sequence exhausted');
    return `${prefix}${String(highest + 1).padStart(4, '0')}`;
  }

  private audit(transaction: Prisma.TransactionClient, actor: CanonicalPrincipal, action: string, description: string) {
    return transaction.auditLog.create({ data: { actorUserId: actor.id, actorName: actor.fullName || actor.email,
      action, entityType: 'Event', description } });
  }

  private id(value: string): string {
    const parsed = uuidPathSchema.safeParse(value);
    if (!parsed.success) throw new BadRequestException('Invalid event ID');
    return parsed.data;
  }

  private safePublic(event: PublicEventRecord) {
    const { registrationUrl, ...safe } = event;
    return {
      ...safe,
      startDate: dateOnly(event.startDate),
      endDate: dateOnly(event.endDate),
      registrationStart: dateOnly(event.registrationStart),
      registrationDeadline: dateOnly(event.registrationDeadline),
      memberFee: event.memberFee?.toString() ?? null,
      nonMemberFee: event.nonMemberFee?.toString() ?? null,
      publishedAt: event.publishedAt?.toISOString() ?? null,
      registrationAvailable: Boolean(registrationUrl),
    };
  }

  private safeAdmin(event: AdminEventRecord) {
    return {
      ...this.safePublic(event),
      slug: event.slug,
      onlineMeetingUrl: event.onlineMeetingUrl,
      registrationUrl: event.registrationUrl,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      cancelledAt: event.cancelledAt?.toISOString() ?? null,
    };
  }
}
