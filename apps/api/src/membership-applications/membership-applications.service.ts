import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { draftMembershipApplicationInputSchema, uuidPathSchema } from '@myais/validation';
import { PrismaService } from '../database/prisma.service.js';
import { EligibilityService } from '../eligibility/eligibility.service.js';

const terminalStatuses = ['ACTIVE', 'REJECTED', 'EXPIRED', 'TERMINATED'] as const;

const applicationSelect = {
  id: true,
  applicationNumber: true,
  requestedMembershipTypeCode: true,
  recommendedMembershipTypeCode: true,
  eligibilityScore: true,
  eligibilityExplanation: true,
  status: true,
  currentStep: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  requestedMembershipType: { select: { name: true } },
  recommendedMembershipType: { select: { name: true } },
} as const;

type ApplicationRecord = {
  id: string;
  applicationNumber: string | null;
  requestedMembershipTypeCode: string | null;
  recommendedMembershipTypeCode: string | null;
  eligibilityScore: number | null;
  eligibilityExplanation: string | null;
  status: string | null;
  currentStep: number | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  requestedMembershipType: { name: string } | null;
  recommendedMembershipType: { name: string } | null;
};

function safeApplication(record: ApplicationRecord) {
  return {
    id: record.id,
    applicationNumber: record.applicationNumber,
    requestedMembershipType: record.requestedMembershipTypeCode ? {
      code: record.requestedMembershipTypeCode,
      name: record.requestedMembershipType?.name ?? null,
    } : null,
    recommendedMembershipType: record.recommendedMembershipTypeCode ? {
      code: record.recommendedMembershipTypeCode,
      name: record.recommendedMembershipType?.name ?? null,
    } : null,
    eligibilityScore: record.eligibilityScore,
    eligibilityExplanation: record.eligibilityExplanation,
    status: record.status,
    currentStep: record.currentStep,
    submittedAt: record.submittedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

@Injectable()
export class MembershipApplicationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly eligibility: EligibilityService,
  ) {}

  async createDraft(userId: string, input: unknown) {
    const parsed = draftMembershipApplicationInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Draft application validation failed',
        errors: parsed.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })),
      });
    }
    const request = parsed.data;
    return this.prisma.client.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 1))::text AS "lock"`;
      const latest = await transaction.membershipApplication.findFirst({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: applicationSelect,
      });
      if (latest && !terminalStatuses.includes(latest.status as (typeof terminalStatuses)[number])) {
        if (latest.status === 'DRAFT') return safeApplication(latest);
        throw new ConflictException('An application is already in progress');
      }
      if (latest) {
        const existingDraft = await transaction.membershipApplication.findFirst({
          where: { userId, status: 'DRAFT' },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: applicationSelect,
        });
        if (existingDraft) return safeApplication(existingDraft);
      }

      const result = await this.eligibility.evaluateWithClient(
        transaction,
        userId,
        request.eligibility ?? {},
      );
      if (!result.selectableTypeCodes.some(code => code === request.requestedMembershipTypeCode)) {
        throw new BadRequestException('Requested membership type is not selectable for this eligibility result');
      }
      const requestedType = await transaction.membershipType.findUnique({
        where: { code: request.requestedMembershipTypeCode },
        select: { id: true, code: true, active: true, applicantSelectable: true },
      });
      if (!requestedType) throw new BadRequestException('Requested membership type does not exist');
      if (requestedType.active !== true) throw new BadRequestException('Requested membership type is inactive');
      if (requestedType.applicantSelectable !== true) {
        throw new BadRequestException('Requested membership type is not applicant-selectable');
      }
      const recommendedType = await transaction.membershipType.findUnique({
        where: { code: result.recommendedTypeCode },
        select: { id: true, code: true, active: true },
      });
      if (!recommendedType || recommendedType.active !== true) {
        throw new ConflictException('Recommended membership type is unavailable');
      }

      const created = await transaction.membershipApplication.create({
        data: {
          userId,
          requestedMembershipTypeId: requestedType.id,
          requestedMembershipTypeCode: requestedType.code,
          recommendedMembershipTypeId: recommendedType.id,
          recommendedMembershipTypeCode: recommendedType.code,
          eligibilityScore: result.score,
          eligibilityExplanation: result.explanation,
          status: 'DRAFT',
          currentStep: 2,
        },
        select: applicationSelect,
      });
      return safeApplication(created);
    });
  }

  async listOwn(userId: string) {
    const records = await this.prisma.client.membershipApplication.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: applicationSelect,
    });
    return records.map(safeApplication);
  }

  async currentOwn(userId: string) {
    const record = await this.prisma.client.membershipApplication.findFirst({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: applicationSelect,
    });
    if (!record || terminalStatuses.includes(record.status as (typeof terminalStatuses)[number])) return null;
    return safeApplication(record);
  }

  async detailOwn(userId: string, applicationId: string) {
    const id = uuidPathSchema.safeParse(applicationId);
    if (!id.success) throw new BadRequestException('Invalid application ID');
    const record = await this.prisma.client.membershipApplication.findFirst({
      where: { id: id.data, userId },
      select: applicationSelect,
    });
    if (!record) throw new NotFoundException('Application not found');
    return safeApplication(record);
  }
}
