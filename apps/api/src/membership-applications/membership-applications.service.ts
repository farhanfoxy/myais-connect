import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  draftMembershipApplicationInputSchema,
  memberProfileInputSchema,
  submitMembershipApplicationSchema,
  uuidPathSchema,
} from '@myais/validation';
import type { Prisma } from '@myais/database';
import { PrismaService } from '../database/prisma.service.js';
import { EligibilityService } from '../eligibility/eligibility.service.js';

const terminalStatuses = ['ACTIVE', 'REJECTED', 'EXPIRED', 'TERMINATED'] as const;
const myaisBusinessTimeZone = 'Asia/Kuala_Lumpur';
const businessYearFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: myaisBusinessTimeZone,
  year: 'numeric',
});

export function myaisBusinessYear(value: Date): number {
  const year = businessYearFormatter.formatToParts(value).find(part => part.type === 'year')?.value;
  if (!year) throw new Error('Unable to derive MyAIS business year');
  return Number(year);
}

const applicationSelect = {
  id: true,
  applicationNumber: true,
  requestedMembershipTypeCode: true,
  recommendedMembershipTypeCode: true,
  eligibilityScore: true,
  eligibilityExplanation: true,
  latestReviewerRemarks: true,
  rejectionReason: true,
  status: true,
  currentStep: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  requestedMembershipType: { select: { name: true } },
  recommendedMembershipType: { select: { name: true } },
  applicationDocumentRecordsByApplication: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      documentType: true,
      originalFileName: true,
      mimeType: true,
      fileSize: true,
      verificationStatus: true,
      createdAt: true,
      storageObjectKey: true,
    },
  },
  applicationReviewRecordsByApplication: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, decision: true, remarks: true, reviewerName: true, createdAt: true },
  },
  informationRequestRecordsByApplication: {
    where: { status: 'OPEN' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, requestedByName: true, message: true, dueDate: true, status: true, createdAt: true },
  },
} satisfies Prisma.MembershipApplicationSelect;

type ApplicationRecord = Prisma.MembershipApplicationGetPayload<{ select: typeof applicationSelect }>;

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
    latestReviewerRemarks: record.latestReviewerRemarks ?? null,
    rejectionReason: record.rejectionReason ?? null,
    status: record.status,
    currentStep: record.currentStep,
    submittedAt: record.submittedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    documents: (record.applicationDocumentRecordsByApplication ?? []).map(document => ({
      id: document.id,
      documentType: document.documentType,
      originalFileName: document.originalFileName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      verificationStatus: document.verificationStatus,
      createdAt: document.createdAt.toISOString(),
      downloadAvailable: document.storageObjectKey !== null,
    })),
    reviewHistory: (record.applicationReviewRecordsByApplication ?? []).map(review => ({
      id: review.id,
      decision: review.decision,
      remarks: review.remarks,
      reviewerName: review.reviewerName,
      createdAt: review.createdAt.toISOString(),
    })),
    openInformationRequests: (record.informationRequestRecordsByApplication ?? []).map(request => ({
      id: request.id,
      requestedByName: request.requestedByName,
      message: request.message,
      dueDate: request.dueDate?.toISOString().slice(0, 10) ?? null,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
    })),
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

  async submitOwn(userId: string, applicationIdInput: string, input: unknown) {
    const id = uuidPathSchema.safeParse(applicationIdInput);
    if (!id.success) throw new BadRequestException('Invalid application ID');
    const submission = submitMembershipApplicationSchema.safeParse(input);
    if (!submission.success) throw new BadRequestException('Declaration must be accepted');
    const applicationId = id.data;
    return this.prisma.client.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${applicationId}, 2))::text AS "lock"`;
      const application = await transaction.membershipApplication.findFirst({
        where: { id: applicationId, userId },
        select: {
          id: true,
          status: true,
          requestedMembershipTypeId: true,
          user: { select: { email: true, fullName: true, legacyFullName: true } },
        },
      });
      if (!application) throw new NotFoundException('Application not found');
      if (application.status !== 'DRAFT') throw new ConflictException('Only a draft application can be submitted');

      const profile = await transaction.memberProfile.findUnique({ where: { userId } });
      if (!profile) throw new BadRequestException('A complete member profile is required');
      const applicantName = this.displayName(profile.fullName, application.user.fullName,
        application.user.legacyFullName);
      const profileValidation = memberProfileInputSchema.safeParse({
        fullName: applicantName,
        identificationType: profile.identificationType,
        identificationNumber: profile.identificationNumber,
        nationality: profile.nationality,
        dateOfBirth: this.dateOnly(profile.dateOfBirth),
        gender: profile.gender,
        phoneNumber: profile.phoneNumber,
        addressLine1: profile.addressLine1,
        addressLine2: profile.addressLine2,
        city: profile.city,
        state: profile.state,
        postcode: profile.postcode,
        country: profile.country,
        institution: profile.institution,
        occupation: profile.occupation,
        department: profile.department,
        areaOfExpertise: profile.areaOfExpertise,
        aisMember: profile.aisMember ?? false,
        aisMembershipNumber: profile.aisMembershipNumber,
        aisMembershipExpiry: this.dateOnly(profile.aisMembershipExpiry),
      });
      if (!profileValidation.success) throw new BadRequestException('A complete member profile is required');

      if (!application.requestedMembershipTypeId) {
        throw new BadRequestException('Requested membership type is missing');
      }
      const requestedType = await transaction.membershipType.findUnique({
        where: { id: application.requestedMembershipTypeId },
        select: { code: true, active: true, applicantSelectable: true },
      });
      if (!requestedType) throw new BadRequestException('Requested membership type does not exist');
      if (requestedType.active !== true) throw new BadRequestException('Requested membership type is inactive');
      if (requestedType.applicantSelectable !== true) {
        throw new BadRequestException('Requested membership type is not applicant-selectable');
      }
      const eligibility = await this.eligibility.evaluateWithClient(transaction, userId, {});
      if (!eligibility.selectableTypeCodes.some(code => code === requestedType.code)) {
        throw new BadRequestException('Requested membership type is no longer permitted');
      }

      const documents = await transaction.applicationDocument.findMany({
        where: { applicationId, userId },
        select: {
          documentType: true,
          storageObjectKey: true,
          fileUrl: true,
          legacyBase44Id: true,
          originalFileName: true,
          mimeType: true,
          fileSize: true,
        },
      });
      const requiredDocumentTypes = ['IDENTIFICATION', 'AIS_MEMBERSHIP_PROOF', 'PROFILE_PHOTO'] as const;
      for (const documentType of requiredDocumentTypes) {
        const present = documents.some(document => document.documentType === documentType &&
          (this.validNativeDocument(document) || Boolean(document.legacyBase44Id && document.fileUrl)));
        if (!present) throw new BadRequestException(`Required document is missing: ${documentType}`);
      }

      const submittedAt = new Date();
      const year = myaisBusinessYear(submittedAt);
      const prefix = `MYAIS-APP-${year}-`;
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${prefix}, 3))::text AS "lock"`;
      const existingNumbers = await transaction.membershipApplication.findMany({
        where: { applicationNumber: { startsWith: prefix } }, select: { applicationNumber: true },
      });
      let highestSuffix = 0;
      const format = new RegExp(`^MYAIS-APP-${year}-(\\d{6})$`);
      for (const existing of existingNumbers) {
        const match = existing.applicationNumber?.match(format);
        if (match?.[1]) highestSuffix = Math.max(highestSuffix, Number(match[1]));
      }
      const nextSuffix = highestSuffix + 1;
      if (nextSuffix > 999999) throw new ConflictException('Application number sequence exhausted');
      const applicationNumber = `${prefix}${String(nextSuffix).padStart(6, '0')}`;

      const updated = await transaction.membershipApplication.update({
        where: { id: applicationId },
        data: { status: 'SUBMITTED', submittedAt, currentStep: 4, applicationNumber },
        select: applicationSelect,
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: userId,
          actorName: applicantName,
          action: 'APPLICATION_SUBMITTED',
          entityType: 'MembershipApplication',
          description: `Application ${applicationNumber} submitted by ${applicantName}`,
        },
      });
      await transaction.notification.create({
        data: {
          userId,
          title: 'Application Submitted',
          message: `Your application ${applicationNumber} has been submitted and will be reviewed by the committee.`,
          type: 'APPLICATION',
          eventType: 'APPLICATION_SUBMITTED',
          relatedEntityType: 'MembershipApplication',
          actionUrl: '/my-application/tracker',
        },
      });
      return safeApplication(updated);
    });
  }

  private dateOnly(value: Date | null): string | null {
    return value?.toISOString().slice(0, 10) ?? null;
  }

  private displayName(...values: (string | null)[]): string {
    for (const value of values) {
      const normalized = value?.trim().replace(/\s+/g, ' ');
      if (normalized) return normalized;
    }
    return 'Applicant';
  }

  private validNativeDocument(document: {
    storageObjectKey: string | null;
    originalFileName: string | null;
    mimeType: string | null;
    fileSize: number | null;
  }): boolean {
    return Boolean(document.storageObjectKey && document.originalFileName?.trim() &&
      document.mimeType && ['application/pdf', 'image/jpeg', 'image/png'].includes(document.mimeType) &&
      document.fileSize && document.fileSize > 0 && document.fileSize <= 5 * 1024 * 1024);
  }
}
