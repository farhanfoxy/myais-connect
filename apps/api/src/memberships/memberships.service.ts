import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

function dateOnly(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

@Injectable()
export class MembershipsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async currentOwn(userId: string) {
    const membership = await this.prisma.client.membership.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        membershipNumber: true,
        membershipTypeCode: true,
        membershipTypeName: true,
        status: true,
        startDate: true,
        expiryDate: true,
        votingEligible: true,
        activatedAt: true,
        membershipType: { select: { code: true, name: true } },
      },
    });
    if (!membership) return null;
    const { membershipType, ...safeMembership } = membership;
    return {
      ...safeMembership,
      membershipTypeCode: membership.membershipTypeCode ?? membershipType.code,
      membershipTypeName: membership.membershipTypeName ?? membershipType.name,
      startDate: dateOnly(membership.startDate),
      expiryDate: dateOnly(membership.expiryDate),
      activatedAt: membership.activatedAt?.toISOString() ?? null,
    };
  }
}
