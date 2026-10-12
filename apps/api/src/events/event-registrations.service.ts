import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@myais/database';
import { randomBytes } from 'node:crypto';
import { adminEventRegistrationQuerySchema, eventTicketCheckInSchema, myEventRegistrationQuerySchema,
  uuidPathSchema } from '@myais/validation';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import { malaysiaCalendarDate, resolveCurrentMembership } from '../memberships/membership-lifecycle.js';

const memberRoles = ['ORDINARY_MEMBER', 'LIFETIME_MEMBER', 'ASSOCIATE_MEMBER', 'HONORARY_MEMBER'];
const activeRegistrationStatuses = ['REGISTERED', 'ATTENDED'] as const;
const memberRegistrationSelect = {
  status: true, registeredAt: true, ticketCode: true, checkedInAt: true,
  event: { select: { id: true, eventNumber: true, title: true, summary: true, status: true, startDate: true,
    startTime: true, endDate: true, endTime: true, venueType: true, venueName: true, physicalAddress: true,
    registrationDeadline: true, timezone: true, cancellationReason: true } },
} satisfies Prisma.EventRegistrationSelect;

function dateOnly(value: Date | null): string | null { return value?.toISOString().slice(0, 10) ?? null; }
function iso(value: Date | null): string | null { return value?.toISOString() ?? null; }

@Injectable()
export class EventRegistrationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async register(actor: CanonicalPrincipal, eventIdInput: string) {
    const eventId = this.id(eventIdInput, 'event');
    return this.prisma.client.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'event-registration:' + eventId}, 17))::text AS "lock"`;
      const event = await transaction.event.findUnique({ where: { id: eventId }, select: { id: true, title: true,
        status: true, startDate: true, registrationStart: true, registrationDeadline: true,
        limitedSeats: true, capacity: true, targetAudience: true } });
      if (!event) throw new NotFoundException('Event not found');
      this.assertRegistrationOpen(event, actor.role);
      const duplicate = await transaction.eventRegistration.findUnique({
        where: { eventId_userId: { eventId, userId: actor.id } }, select: { id: true } });
      if (duplicate) throw new ConflictException('You are already registered for this event');
      if (event.limitedSeats && event.capacity !== null) {
        const count = await transaction.eventRegistration.count({ where: { eventId, status: { in: [...activeRegistrationStatuses] } } });
        if (count >= Math.floor(event.capacity)) throw new ConflictException('This event is full');
      }
      const registration = await transaction.eventRegistration.create({ data: { eventId, userId: actor.id,
        attendeeName: actor.fullName, attendeeEmail: actor.email, status: 'REGISTERED', registeredAt: new Date(),
        ticketCode: this.ticketCode() }, select: memberRegistrationSelect });
      await transaction.notification.create({ data: { userId: actor.id, type: 'SYSTEM',
        eventType: 'EVENT_REGISTRATION_CONFIRMED', title: 'Event registration confirmed', message: event.title,
        relatedEntityType: 'Event', actionUrl: `/events/${event.id}` } });
      await this.audit(transaction, actor, 'EVENT_REGISTRATION_CONFIRMED', 'Registered for an event');
      return this.safeMember(registration);
    });
  }

  async cancelOwn(actor: CanonicalPrincipal, eventIdInput: string) {
    const eventId = this.id(eventIdInput, 'event');
    return this.prisma.client.$transaction(async transaction => {
      const registration = await transaction.eventRegistration.findUnique({
        where: { eventId_userId: { eventId, userId: actor.id } },
        select: { id: true, status: true, event: { select: { title: true } } },
      });
      if (!registration) throw new NotFoundException('Event registration not found');
      if (registration.status === 'CANCELLED') return { status: 'CANCELLED', cancelled: true };
      if (registration.status !== 'REGISTERED') throw new ConflictException('This registration cannot be cancelled');
      await transaction.eventRegistration.update({ where: { id: registration.id }, data: { status: 'CANCELLED' } });
      await transaction.notification.create({ data: { userId: actor.id, type: 'SYSTEM',
        eventType: 'EVENT_REGISTRATION_CANCELLED', title: 'Event registration cancelled', message: registration.event.title,
        relatedEntityType: 'Event', actionUrl: `/events/${eventId}` } });
      await this.audit(transaction, actor, 'EVENT_REGISTRATION_CANCELLED', 'Cancelled an event registration');
      return { status: 'CANCELLED', cancelled: true };
    });
  }

  async ownForEvent(userId: string, eventIdInput: string) {
    const eventId = this.id(eventIdInput, 'event');
    const registration = await this.prisma.client.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } }, select: memberRegistrationSelect });
    if (!registration) return null;
    return this.safeMember(await this.ensureTicket(userId, eventId, registration));
  }

  async ownList(userId: string, input: unknown) {
    const parsed = myEventRegistrationQuerySchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid event registration query');
    const today = new Date(`${malaysiaCalendarDate()}T00:00:00.000Z`);
    const dateFilter = parsed.data.scope === 'UPCOMING' ? { gte: today } : parsed.data.scope === 'PAST' ? { lt: today } : undefined;
    const registrations = await this.prisma.client.eventRegistration.findMany({ where: { userId,
      ...(dateFilter ? { event: { startDate: dateFilter } } : {}) },
      orderBy: [{ event: { startDate: 'asc' } }, { registeredAt: 'desc' }], select: memberRegistrationSelect });
    return Promise.all(registrations.map(async registration => this.safeMember(
      await this.ensureTicket(userId, registration.event.id, registration))));
  }

  async adminList(eventIdInput: string, input: unknown) {
    const eventId = this.id(eventIdInput, 'event');
    const parsed = adminEventRegistrationQuerySchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid attendee query');
    const event = await this.prisma.client.event.findUnique({ where: { id: eventId },
      select: { id: true, eventNumber: true, title: true, capacity: true, limitedSeats: true, status: true } });
    if (!event) throw new NotFoundException('Event not found');
    const { search, status, page, pageSize } = parsed.data;
    const where: Prisma.EventRegistrationWhereInput = { eventId, ...(status !== 'ALL' ? { status } : {}) };
    if (search) where.OR = [{ attendeeName: { contains: search, mode: 'insensitive' } },
      { attendeeEmail: { contains: search, mode: 'insensitive' } },
      { user: { membershipRecordsByUser: { some: { membershipNumber: { contains: search, mode: 'insensitive' } } } } }];
    const [rows, total, registeredCount, attendanceCount] = await this.prisma.client.$transaction([
      this.prisma.client.eventRegistration.findMany({ where, orderBy: [{ registeredAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize, take: pageSize, select: { id: true, attendeeName: true,
          status: true, registeredAt: true, checkedInAt: true, user: { select: { fullName: true,
            membershipRecordsByUser: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true,
              membershipNumber: true, membershipTypeCode: true, membershipTypeName: true, status: true,
              expiryDate: true, createdAt: true, membershipType: { select: { code: true, name: true } } } } } } } }),
      this.prisma.client.eventRegistration.count({ where }),
      this.prisma.client.eventRegistration.count({ where: { eventId, status: { in: [...activeRegistrationStatuses] } } }),
      this.prisma.client.eventRegistration.count({ where: { eventId, status: 'ATTENDED' } }),
    ]);
    return { event, items: rows.map(row => { const membership = resolveCurrentMembership(row.user.membershipRecordsByUser);
      return { id: row.id, name: row.attendeeName ?? row.user.fullName,
        status: row.status, registeredAt: iso(row.registeredAt), checkedInAt: iso(row.checkedInAt),
        membershipNumber: membership?.membershipNumber ?? null,
        membershipType: membership ? membership.membershipTypeName ?? membership.membershipType.name : null }; }),
      page, pageSize, total, totalPages: Math.ceil(total / pageSize), registeredCount, attendanceCount };
  }

  qrCheckIn(actor: CanonicalPrincipal, eventIdInput: string, input: unknown) {
    const parsed = eventTicketCheckInSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid event ticket');
    return this.checkIn(actor, eventIdInput, { ticketCode: parsed.data.ticketCode }, 'QR');
  }

  manualCheckIn(actor: CanonicalPrincipal, eventIdInput: string, registrationIdInput: string) {
    return this.checkIn(actor, eventIdInput, { id: this.id(registrationIdInput, 'registration') }, 'MANUAL');
  }

  private async checkIn(actor: CanonicalPrincipal, eventIdInput: string, registrationWhere: { id: string } | { ticketCode: string },
    method: 'QR' | 'MANUAL') {
    const eventId = this.id(eventIdInput, 'event');
    return this.prisma.client.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'event-check-in:' + eventId}, 19))::text AS "lock"`;
      const event = await transaction.event.findUnique({ where: { id: eventId }, select: { id: true, title: true, status: true } });
      if (!event) throw new NotFoundException('Event not found');
      if (event.status === 'CANCELLED') throw new ConflictException('Cancelled events cannot accept check-in');
      const registration = await transaction.eventRegistration.findFirst({ where: { ...registrationWhere, eventId },
        select: { id: true, userId: true, status: true, checkedInAt: true } });
      if (!registration) throw new NotFoundException('Event ticket not found');
      if (registration.status === 'CANCELLED') throw new ConflictException('This event registration is cancelled');
      if (registration.status === 'ATTENDED') return { status: 'ATTENDED', checkedInAt: iso(registration.checkedInAt),
        alreadyCheckedIn: true, message: 'Already checked in' };
      if (registration.status !== 'REGISTERED') throw new ConflictException('This event registration cannot be checked in');
      const now = new Date();
      await transaction.eventRegistration.update({ where: { id: registration.id }, data: {
        status: 'ATTENDED', checkedInAt: now, checkedInByUserId: actor.id } });
      await transaction.notification.create({ data: { userId: registration.userId, type: 'SYSTEM',
        eventType: 'EVENT_CHECKED_IN', title: 'Event check-in confirmed', message: event.title,
        relatedEntityType: 'Event', actionUrl: `/events/${event.id}` } });
      await this.audit(transaction, actor, method === 'QR' ? 'EVENT_QR_CHECK_IN' : 'EVENT_MANUAL_CHECK_IN',
        `${method === 'QR' ? 'QR' : 'Manual'} event check-in recorded`);
      return { status: 'ATTENDED', checkedInAt: now.toISOString(), alreadyCheckedIn: false, message: 'Check-in confirmed' };
    });
  }

  private assertRegistrationOpen(event: { status: string | null; startDate: Date; registrationStart: Date | null;
    registrationDeadline: Date | null; targetAudience: string | null }, role: string | null) {
    if (event.status !== 'PUBLISHED') throw new ConflictException('Event registration is unavailable');
    const today = malaysiaCalendarDate();
    const start = dateOnly(event.registrationStart); const deadline = dateOnly(event.registrationDeadline);
    if (start && today < start) throw new ConflictException('Event registration is not open yet');
    if ((deadline && today > deadline) || today > dateOnly(event.startDate)!) throw new ConflictException('Event registration is closed');
    const member = memberRoles.includes(role ?? '');
    if ((event.targetAudience === 'MEMBERS' && !member) || (event.targetAudience === 'NON_MEMBERS' && member)) {
      throw new ConflictException('This event is not available for your account');
    }
  }

  private async ensureTicket(userId: string, eventId: string,
    registration: Prisma.EventRegistrationGetPayload<{ select: typeof memberRegistrationSelect }>) {
    if (registration.ticketCode || registration.status === 'CANCELLED') return registration;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.client.eventRegistration.update({ where: { eventId_userId: { eventId, userId } },
          data: { ticketCode: this.ticketCode() }, select: memberRegistrationSelect });
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002' || attempt === 2) throw error;
      }
    }
    return registration;
  }

  private safeMember(registration: Prisma.EventRegistrationGetPayload<{ select: typeof memberRegistrationSelect }>) {
    return { status: registration.status, registeredAt: iso(registration.registeredAt),
      checkedInAt: iso(registration.checkedInAt), ticketCode: registration.status === 'CANCELLED' ? null : registration.ticketCode,
      event: { ...registration.event, startDate: dateOnly(registration.event.startDate),
        endDate: dateOnly(registration.event.endDate), registrationDeadline: dateOnly(registration.event.registrationDeadline) } };
  }

  private ticketCode(): string { return randomBytes(24).toString('base64url'); }
  private id(input: string, label: string): string {
    const parsed = uuidPathSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(`Invalid ${label} ID`);
    return parsed.data;
  }
  private audit(transaction: Prisma.TransactionClient, actor: CanonicalPrincipal, action: string, description: string) {
    return transaction.auditLog.create({ data: { actorUserId: actor.id, actorName: actor.fullName || actor.email,
      action, entityType: 'EventRegistration', description } });
  }
}
