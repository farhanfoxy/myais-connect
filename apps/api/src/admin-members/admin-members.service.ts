import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@myais/database';
import { adminMemberQuerySchema, uuidPathSchema } from '@myais/validation';
import { PrismaService } from '../database/prisma.service.js';
import { resolveCurrentMembership, visibleMembershipStatus } from '../memberships/membership-lifecycle.js';

const membershipSelect = {
  id: true, membershipNumber: true, membershipTypeCode: true, membershipTypeName: true,
  status: true, startDate: true, expiryDate: true, activatedAt: true, createdAt: true,
  membershipType: { select: { code: true, name: true } },
} satisfies Prisma.MembershipSelect;

function iso(value: Date | null): string | null { return value?.toISOString() ?? null; }
function dateOnly(value: Date | null): string | null { return value?.toISOString().slice(0, 10) ?? null; }

@Injectable()
export class AdminMembersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(input: unknown) {
    const parsed = adminMemberQuerySchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid member query');
    const { page, pageSize, search, membershipType, membershipStatus, accountStatus, sort, order } = parsed.data;
    const membershipFilter: Prisma.MembershipWhereInput = {};
    if (membershipType !== 'ALL') membershipFilter.membershipType = { code: membershipType };
    if (membershipStatus !== 'ALL') membershipFilter.status = membershipStatus;
    const where: Prisma.UserWhereInput = {
      ...(accountStatus !== 'ALL' ? { accountStatus } : {}),
      membershipRecordsByUser: { some: membershipFilter },
    };
    if (search) where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { membershipRecordsByUser: { some: { membershipNumber: { contains: search, mode: 'insensitive' } } } },
    ];
    const orderBy: Prisma.UserOrderByWithRelationInput = sort === 'name' ? { fullName: order } :
      sort === 'email' ? { email: order } : sort === 'accountStatus' ? { accountStatus: order } : { createdAt: order };
    const [users, total] = await this.prisma.client.$transaction([
      this.prisma.client.user.findMany({ where, orderBy: [orderBy, { id: 'asc' }], skip: (page - 1) * pageSize,
        take: pageSize, select: { id: true, fullName: true, email: true, accountStatus: true, createdAt: true } }),
      this.prisma.client.user.count({ where }),
    ]);
    const memberships = users.length ? await this.prisma.client.membership.findMany({
      where: { userId: { in: users.map(user => user.id) } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { ...membershipSelect, userId: true },
    }) : [];
    return { items: users.map(user => {
      const membership = resolveCurrentMembership(memberships.filter(item => item.userId === user.id));
      return { id: user.id, name: user.fullName, email: user.email, accountStatus: user.accountStatus,
        joinedAt: iso(membership?.activatedAt ?? membership?.createdAt ?? user.createdAt),
        membership: membership ? this.membership(membership) : null };
    }), page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  async detail(input: string) {
    const id = uuidPathSchema.safeParse(input);
    if (!id.success) throw new BadRequestException('Invalid member ID');
    const user = await this.prisma.client.user.findUnique({ where: { id: id.data }, select: {
      id: true, fullName: true, email: true, phoneNumber: true, photoUrl: true, role: true, accountStatus: true, createdAt: true,
      memberProfileByUser: { select: { city: true, state: true, country: true, institution: true, occupation: true,
        department: true, areaOfExpertise: true } },
      membershipRecordsByUser: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: membershipSelect },
      membershipApplicationRecordsByUser: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: {
        id: true, applicationNumber: true, status: true, requestedMembershipTypeCode: true,
        submittedAt: true, approvedAt: true, rejectedAt: true, createdAt: true,
      } },
      paymentRecordsByUser: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: {
        id: true, paymentReference: true, paymentType: true, totalAmount: true, currency: true, status: true,
        submittedAt: true, verifiedAt: true, createdAt: true,
      } },
      eventRegistrationRecordsByUser: { orderBy: [{ registeredAt: 'desc' }, { createdAt: 'desc' }], select: {
        id: true, status: true, registeredAt: true, checkedInAt: true,
        event: { select: { id: true, eventNumber: true, title: true, startDate: true, startTime: true, status: true } },
      } },
    } });
    if (!user) throw new NotFoundException('Member not found');
    const activity = await this.prisma.client.auditLog.findMany({ where: { actorUserId: user.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20,
      select: { id: true, action: true, entityType: true, description: true, createdAt: true } });
    const current = resolveCurrentMembership(user.membershipRecordsByUser);
    return { profile: { id: user.id, name: user.fullName, email: user.email, phoneNumber: user.phoneNumber,
      photoUrl: user.photoUrl, role: user.role, accountStatus: user.accountStatus, createdAt: user.createdAt.toISOString(),
      ...user.memberProfileByUser }, currentMembership: current ? this.membership(current) : null,
      membershipHistory: user.membershipRecordsByUser.map(item => this.membership(item)),
      applicationHistory: user.membershipApplicationRecordsByUser.map(item => ({ ...item,
        submittedAt: iso(item.submittedAt), approvedAt: iso(item.approvedAt), rejectedAt: iso(item.rejectedAt),
        createdAt: item.createdAt.toISOString() })),
      paymentHistory: user.paymentRecordsByUser.map(item => ({ ...item, totalAmount: item.totalAmount.toString(),
        submittedAt: iso(item.submittedAt), verifiedAt: iso(item.verifiedAt), createdAt: item.createdAt.toISOString() })),
      eventRegistrations: user.eventRegistrationRecordsByUser.map(item => ({ ...item,
        registeredAt: iso(item.registeredAt), checkedInAt: iso(item.checkedInAt), event: { ...item.event,
          startDate: dateOnly(item.event.startDate) } })),
      activity: activity.map(item => ({ ...item, createdAt: item.createdAt.toISOString() })) };
  }

  private membership(record: Prisma.MembershipGetPayload<{ select: typeof membershipSelect }>) {
    return { id: record.id, membershipNumber: record.membershipNumber,
      membershipTypeCode: record.membershipTypeCode ?? record.membershipType.code,
      membershipTypeName: record.membershipTypeName ?? record.membershipType.name,
      status: visibleMembershipStatus(record), startDate: dateOnly(record.startDate), expiryDate: dateOnly(record.expiryDate),
      activatedAt: iso(record.activatedAt), noExpiry: record.expiryDate === null };
  }
}
