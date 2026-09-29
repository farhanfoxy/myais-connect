import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class MembershipTypesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listApproverTypes() {
    return this.prisma.client.membershipType.findMany({
      where: { active: true },
      orderBy: [{ name: 'asc' }, { code: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
      },
    });
  }

  async listApplicantTypes() {
    const records = await this.prisma.client.membershipType.findMany({
      where: { active: true, applicantSelectable: true },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        entranceFee: true,
        membershipFee: true,
      },
    });
    return records.map(record => ({
      ...record,
      entranceFee: record.entranceFee?.toString() ?? null,
      membershipFee: record.membershipFee?.toString() ?? null,
    }));
  }
}
