import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '@myais/database';
import { Prisma as PrismaRuntime, UserAccountStatus, UserRole } from '@myais/database';
import {
  reviewerApproveSchema,
  reviewerApplicationQueueSchema,
  reviewerOptionalRemarksSchema,
  reviewerRejectSchema,
  reviewerRequestInformationSchema,
  uuidPathSchema,
} from '@myais/validation';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  PRIVATE_STORAGE,
  type PrivateStorage,
  PrivateStorageUnavailableError,
  PrivateUploadNotFoundError,
} from '../storage/private-storage.js';
import { myaisBusinessYear } from '../membership-applications/membership-applications.service.js';

const downloadTtlSeconds = 5 * 60;
const myaisBusinessTimeZone = 'Asia/Kuala_Lumpur';
const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: myaisBusinessTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function myaisBusinessDate(value: Date): string {
  const parts = businessDateFormatter.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(valuePart => valuePart.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  if (!year || !month || !day) throw new Error('Unable to derive MyAIS business date');
  return `${year}-${month}-${day}`;
}

const queueSelect = {
  id: true,
  applicationNumber: true,
  requestedMembershipTypeCode: true,
  recommendedMembershipTypeCode: true,
  submittedAt: true,
  status: true,
  createdAt: true,
  requestedMembershipType: { select: { name: true } },
  recommendedMembershipType: { select: { name: true } },
  user: {
    select: {
      email: true,
      fullName: true,
      legacyFullName: true,
      memberProfileByUser: { select: { fullName: true } },
    },
  },
} satisfies Prisma.MembershipApplicationSelect;

const detailSelect = {
  id: true,
  applicationNumber: true,
  status: true,
  requestedMembershipTypeCode: true,
  recommendedMembershipTypeCode: true,
  eligibilityScore: true,
  eligibilityExplanation: true,
  latestReviewerRemarks: true,
  rejectionReason: true,
  submittedAt: true,
  reviewedAt: true,
  approvedAt: true,
  rejectedAt: true,
  createdAt: true,
  updatedAt: true,
  requestedMembershipType: { select: { name: true } },
  recommendedMembershipType: { select: { name: true } },
  user: {
    select: {
      email: true,
      fullName: true,
      legacyFullName: true,
      memberProfileByUser: {
        select: {
          fullName: true,
          nationality: true,
          dateOfBirth: true,
          institution: true,
          aisMember: true,
          aisMembershipNumber: true,
          aisMembershipExpiry: true,
        },
      },
    },
  },
  applicationDocumentRecordsByApplication: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      documentType: true,
      originalFileName: true,
      mimeType: true,
      fileSize: true,
      verificationStatus: true,
      reviewerRemarks: true,
      verifiedAt: true,
      createdAt: true,
      storageObjectKey: true,
    },
  },
  applicationReviewRecordsByApplication: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      reviewerName: true,
      decision: true,
      remarks: true,
      previousStatus: true,
      newStatus: true,
      createdAt: true,
    },
  },
} satisfies Prisma.MembershipApplicationSelect;

type QueueRecord = Prisma.MembershipApplicationGetPayload<{ select: typeof queueSelect }>;
type DetailRecord = Prisma.MembershipApplicationGetPayload<{ select: typeof detailSelect }>;
type ReviewPrincipal = Pick<CanonicalPrincipal, 'id' | 'email' | 'fullName'>;

@Injectable()
export class ReviewerApplicationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PRIVATE_STORAGE) private readonly storage: PrivateStorage,
  ) {}

  async list(input: unknown) {
    const parsed = reviewerApplicationQueueSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid reviewer queue query');
    const { page, pageSize, search, status } = parsed.data;
    const where: Prisma.MembershipApplicationWhereInput = {};
    if (status !== 'ALL') where.status = status;
    if (search) {
      where.OR = [
        { applicationNumber: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
        { user: { legacyFullName: { contains: search, mode: 'insensitive' } } },
        { user: { memberProfileByUser: { is: { fullName: { contains: search, mode: 'insensitive' } } } } },
      ];
    }
    const [records, total] = await this.prisma.client.$transaction([
      this.prisma.client.membershipApplication.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: queueSelect,
      }),
      this.prisma.client.membershipApplication.count({ where }),
    ]);
    return {
      items: records.map(record => this.safeQueueRecord(record)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async detail(applicationIdInput: string) {
    const applicationId = this.id(applicationIdInput, 'application');
    const record = await this.prisma.client.membershipApplication.findUnique({
      where: { id: applicationId },
      select: detailSelect,
    });
    if (!record) throw new NotFoundException('Application not found');
    return this.safeDetailRecord(record);
  }

  async downloadDocument(applicationIdInput: string, documentIdInput: string) {
    const applicationId = this.id(applicationIdInput, 'application');
    const documentId = this.id(documentIdInput, 'document');
    const document = await this.prisma.client.applicationDocument.findFirst({
      where: { id: documentId, applicationId },
      select: { storageObjectKey: true },
    });
    if (!document) throw new NotFoundException('Document not found');
    if (!document.storageObjectKey) {
      throw new ConflictException('Private download is unavailable for this legacy document');
    }
    try {
      return await this.storage.createDownloadTarget(document.storageObjectKey, downloadTtlSeconds);
    } catch (error) {
      if (error instanceof PrivateUploadNotFoundError) throw new NotFoundException('Private document not found');
      if (error instanceof PrivateStorageUnavailableError) throw new ServiceUnavailableException(error.message);
      throw error;
    }
  }

  async startReview(reviewer: ReviewPrincipal, applicationIdInput: string, input: unknown) {
    const parsed = reviewerOptionalRemarksSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid start-review input');
    return await this.transition(reviewer, applicationIdInput, {
      decision: 'START_REVIEW',
      allowedStatuses: ['SUBMITTED'],
      newStatus: 'UNDER_REVIEW',
      remarks: parsed.data.remarks,
    });
  }

  async requestInformation(reviewer: ReviewPrincipal, applicationIdInput: string, input: unknown) {
    const parsed = reviewerRequestInformationSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Information-request remarks are required');
    return await this.transition(reviewer, applicationIdInput, {
      decision: 'REQUEST_INFORMATION',
      allowedStatuses: ['UNDER_REVIEW'],
      newStatus: 'ADDITIONAL_INFORMATION_REQUIRED',
      remarks: parsed.data.remarks,
      dueDate: parsed.data.dueDate ?? null,
    });
  }

  async recommendApproval(reviewer: ReviewPrincipal, applicationIdInput: string, input: unknown) {
    const parsed = reviewerOptionalRemarksSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid recommendation input');
    return await this.transition(reviewer, applicationIdInput, {
      decision: 'RECOMMEND_APPROVAL',
      allowedStatuses: ['UNDER_REVIEW'],
      newStatus: 'RECOMMENDED_FOR_APPROVAL',
      remarks: parsed.data.remarks,
    });
  }

  async reject(reviewer: ReviewPrincipal, applicationIdInput: string, input: unknown) {
    const parsed = reviewerRejectSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Rejection remarks are required');
    return await this.transition(reviewer, applicationIdInput, {
      decision: 'REJECT',
      allowedStatuses: ['UNDER_REVIEW', 'RECOMMENDED_FOR_APPROVAL'],
      newStatus: 'REJECTED',
      remarks: parsed.data.remarks,
    });
  }

  async approve(reviewer: CanonicalPrincipal, applicationIdInput: string, input: unknown) {
    if (reviewer.accountStatus !== UserAccountStatus.ACTIVE ||
      (reviewer.role !== UserRole.PRESIDENT && reviewer.role !== UserRole.SYSTEM_ADMINISTRATOR)) {
      throw new ForbiddenException('Insufficient role');
    }
    const parsed = reviewerApproveSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid approval input');
    const applicationId = this.id(applicationIdInput, 'application');
    const { approvedMembershipTypeId, remarks } = parsed.data;

    return this.prisma.client.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${applicationId}, 2))::text AS "lock"`;
      const application = await transaction.membershipApplication.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          userId: true,
          applicationNumber: true,
          status: true,
          latestReviewerRemarks: true,
        },
      });
      if (!application) throw new NotFoundException('Application not found');
      if (application.userId === reviewer.id) {
        throw new ForbiddenException('Reviewers cannot approve their own application');
      }
      if (application.status !== 'RECOMMENDED_FOR_APPROVAL') {
        throw new ConflictException('Application is not in a valid state for approval');
      }

      const approvedType = await transaction.membershipType.findUnique({
        where: { id: approvedMembershipTypeId },
        select: {
          id: true,
          code: true,
          name: true,
          entranceFee: true,
          membershipFee: true,
          votingRights: true,
          active: true,
        },
      });
      if (!approvedType) throw new BadRequestException('Approved membership type does not exist');
      if (approvedType.active !== true) throw new BadRequestException('Approved membership type is inactive');

      const approvedAt = new Date();
      const year = myaisBusinessYear(approvedAt);
      const paymentReference = await this.nextPaymentReference(transaction, year);
      const honorary = approvedType.code === 'HONORARY';
      const membershipNumber = honorary ? await this.nextMembershipNumber(transaction, year) : null;
      const newStatus = honorary ? 'ACTIVE' : 'APPROVED_PENDING_PAYMENT';
      const reviewerName = this.reviewerName(reviewer);
      const entranceFee = approvedType.entranceFee ?? new PrismaRuntime.Decimal(0);
      const membershipFee = approvedType.membershipFee ?? new PrismaRuntime.Decimal(0);

      await transaction.membershipApplication.update({
        where: { id: applicationId },
        data: {
          status: newStatus,
          approvedMembershipType: { connect: { id: approvedType.id } },
          approvedMembershipTypeCode: approvedType.code,
          approvedAt,
          approvedByUser: { connect: { id: reviewer.id } },
          reviewedByUser: { connect: { id: reviewer.id } },
          reviewedAt: approvedAt,
          latestReviewerRemarks: remarks || application.latestReviewerRemarks,
        },
      });
      await transaction.payment.create({
        data: {
          paymentReference,
          userId: application.userId,
          applicationId,
          paymentType: approvedType.code === 'LIFETIME'
            ? 'ENTRANCE_AND_LIFETIME'
            : honorary ? 'OTHER' : 'ENTRANCE_AND_ANNUAL',
          entranceFee,
          membershipFee,
          totalAmount: entranceFee.plus(membershipFee),
          currency: 'MYR',
          status: honorary ? 'VERIFIED' : 'NOT_SUBMITTED',
        },
      });
      if (honorary) {
        await transaction.membership.create({
          data: {
            membershipNumber,
            userId: application.userId,
            applicationId,
            membershipTypeId: approvedType.id,
            membershipTypeCode: approvedType.code,
            membershipTypeName: approvedType.name,
            startDate: new Date(`${myaisBusinessDate(approvedAt)}T00:00:00.000Z`),
            status: 'ACTIVE',
            votingEligible: approvedType.votingRights || false,
            activatedAt: approvedAt,
          },
        });
      }
      await transaction.notification.create({
        data: {
          userId: application.userId,
          title: 'Application Approved!',
          message: `Your membership application has been approved as ${approvedType.name}. ${honorary
            ? 'Your membership is now active.'
            : 'Please submit your payment to activate your membership.'}`,
          type: 'APPLICATION',
          relatedEntityType: 'MembershipApplication',
          actionUrl: honorary ? '/my-card' : '/my-application/payment',
        },
      });
      await transaction.applicationReview.create({
        data: {
          applicationId,
          reviewerUserId: reviewer.id,
          reviewerName,
          decision: 'APPROVE',
          remarks,
          previousStatus: application.status,
          newStatus,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: reviewer.id,
          actorName: reviewerName,
          action: 'APPLICATION_APPROVE',
          entityType: 'MembershipApplication',
          description: `APPROVE on ${application.applicationNumber}. Remarks: ${remarks}`,
        },
      });
      return {
        id: applicationId,
        status: newStatus,
        approvedMembershipType: { id: approvedType.id, code: approvedType.code, name: approvedType.name },
        approvedAt: approvedAt.toISOString(),
        paymentReference,
        membershipNumber,
      };
    });
  }

  private async transition(
    reviewer: ReviewPrincipal,
    applicationIdInput: string,
    action: {
      decision: 'START_REVIEW' | 'REQUEST_INFORMATION' | 'RECOMMEND_APPROVAL' | 'REJECT';
      allowedStatuses: string[];
      newStatus: 'UNDER_REVIEW' | 'ADDITIONAL_INFORMATION_REQUIRED' | 'RECOMMENDED_FOR_APPROVAL' | 'REJECTED';
      remarks: string;
      dueDate?: string | null;
    },
  ) {
    const applicationId = this.id(applicationIdInput, 'application');
    return this.prisma.client.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${applicationId}, 2))::text AS "lock"`;
      const application = await transaction.membershipApplication.findUnique({
        where: { id: applicationId },
        select: { id: true, userId: true, applicationNumber: true, status: true, latestReviewerRemarks: true },
      });
      if (!application) throw new NotFoundException('Application not found');
      if (application.userId === reviewer.id) {
        throw new ForbiddenException('Reviewers cannot review their own application');
      }
      if (!application.status || !action.allowedStatuses.includes(application.status)) {
        throw new ConflictException('Application is not in a valid state for this action');
      }

      const reviewedAt = new Date();
      const reviewerName = this.reviewerName(reviewer);
      if (action.decision === 'REQUEST_INFORMATION') {
        await transaction.informationRequest.create({
          data: {
            applicationId,
            requestedByUserId: reviewer.id,
            requestedByName: reviewerName,
            message: action.remarks,
            dueDate: action.dueDate ? new Date(`${action.dueDate}T00:00:00.000Z`) : null,
            status: 'OPEN',
          },
        });
      }

      const applicationData: Prisma.MembershipApplicationUpdateInput = {
        status: action.newStatus,
        reviewedByUser: { connect: { id: reviewer.id } },
        reviewedAt,
        latestReviewerRemarks: action.remarks || application.latestReviewerRemarks,
      };
      if (action.decision === 'REJECT') {
        applicationData.rejectedAt = reviewedAt;
        applicationData.rejectionReason = action.remarks;
      }
      await transaction.membershipApplication.update({
        where: { id: applicationId },
        data: applicationData,
      });
      await transaction.applicationReview.create({
        data: {
          applicationId,
          reviewerUserId: reviewer.id,
          reviewerName,
          decision: action.decision,
          remarks: action.remarks,
          previousStatus: application.status,
          newStatus: action.newStatus,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: reviewer.id,
          actorName: reviewerName,
          action: `APPLICATION_${action.decision}`,
          entityType: 'MembershipApplication',
          description: `${action.decision.replace(/_/g, ' ')} on ${application.applicationNumber}. Remarks: ${action.remarks}`,
        },
      });
      if (action.decision === 'REJECT') {
        await transaction.notification.create({
          data: {
            userId: application.userId,
            title: 'Application Rejected',
            message: `Your membership application has been rejected. Reason: ${action.remarks}`,
            type: 'APPLICATION',
            relatedEntityType: 'MembershipApplication',
            actionUrl: '/my-application/tracker',
          },
        });
      }
      return { id: applicationId, status: action.newStatus, reviewedAt: reviewedAt.toISOString() };
    });
  }

  private async nextPaymentReference(transaction: Prisma.TransactionClient, year: number): Promise<string> {
    const prefix = `MYAIS-PAY-${year}-`;
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${prefix}, 4))::text AS "lock"`;
    const records = await transaction.payment.findMany({
      where: { paymentReference: { startsWith: prefix } },
      select: { paymentReference: true },
    });
    return this.nextReference(prefix, records.map(record => record.paymentReference),
      `^MYAIS-PAY-${year}-(\\d{6})$`, 'Payment');
  }

  private async nextMembershipNumber(transaction: Prisma.TransactionClient, year: number): Promise<string> {
    const prefix = `MYAIS-${year}-`;
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${prefix}, 5))::text AS "lock"`;
    const records = await transaction.membership.findMany({
      where: { membershipNumber: { startsWith: prefix } },
      select: { membershipNumber: true },
    });
    return this.nextReference(prefix, records.map(record => record.membershipNumber),
      `^MYAIS-${year}-(\\d{6})$`, 'Membership');
  }

  private nextReference(prefix: string, values: (string | null)[], pattern: string, label: string): string {
    const format = new RegExp(pattern);
    let highestSuffix = 0;
    for (const value of values) {
      const match = value?.match(format);
      if (match?.[1]) highestSuffix = Math.max(highestSuffix, Number(match[1]));
    }
    const nextSuffix = highestSuffix + 1;
    if (nextSuffix > 999999) throw new ConflictException(`${label} number sequence exhausted`);
    return `${prefix}${String(nextSuffix).padStart(6, '0')}`;
  }

  private safeQueueRecord(record: QueueRecord) {
    return {
      id: record.id,
      applicationNumber: record.applicationNumber,
      applicantName: this.displayName(record.user.email, record.user.memberProfileByUser?.fullName,
        record.user.fullName, record.user.legacyFullName),
      applicantEmail: record.user.email,
      requestedMembershipType: record.requestedMembershipTypeCode ? {
        code: record.requestedMembershipTypeCode,
        name: record.requestedMembershipType?.name ?? null,
      } : null,
      recommendedMembershipType: record.recommendedMembershipTypeCode ? {
        code: record.recommendedMembershipTypeCode,
        name: record.recommendedMembershipType?.name ?? null,
      } : null,
      submittedAt: record.submittedAt?.toISOString() ?? null,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
    };
  }

  private safeDetailRecord(record: DetailRecord) {
    const profile = record.user.memberProfileByUser;
    return {
      id: record.id,
      applicationNumber: record.applicationNumber,
      status: record.status,
      applicant: {
        displayName: this.displayName(record.user.email, profile?.fullName,
          record.user.fullName, record.user.legacyFullName),
        email: record.user.email,
        nationality: profile?.nationality ?? null,
        dateOfBirth: this.dateOnly(profile?.dateOfBirth ?? null),
        institution: profile?.institution ?? null,
        aisMember: profile?.aisMember ?? false,
        aisMembershipNumber: profile?.aisMembershipNumber ?? null,
        aisMembershipExpiry: this.dateOnly(profile?.aisMembershipExpiry ?? null),
      },
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
      latestReviewerRemarks: record.latestReviewerRemarks,
      rejectionReason: record.rejectionReason,
      submittedAt: record.submittedAt?.toISOString() ?? null,
      reviewedAt: record.reviewedAt?.toISOString() ?? null,
      approvedAt: record.approvedAt?.toISOString() ?? null,
      rejectedAt: record.rejectedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      documents: record.applicationDocumentRecordsByApplication.map(document => ({
        id: document.id,
        documentType: document.documentType,
        originalFileName: document.originalFileName,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        verificationStatus: document.verificationStatus,
        reviewerRemarks: document.reviewerRemarks,
        verifiedAt: document.verifiedAt?.toISOString() ?? null,
        createdAt: document.createdAt.toISOString(),
        downloadAvailable: document.storageObjectKey !== null,
      })),
      reviewHistory: record.applicationReviewRecordsByApplication.map(review => ({
        id: review.id,
        reviewerName: review.reviewerName,
        decision: review.decision,
        remarks: review.remarks,
        previousStatus: review.previousStatus,
        newStatus: review.newStatus,
        createdAt: review.createdAt.toISOString(),
      })),
    };
  }

  private id(input: string, label: string): string {
    const parsed = uuidPathSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(`Invalid ${label} ID`);
    return parsed.data;
  }

  private dateOnly(value: Date | null): string | null {
    return value?.toISOString().slice(0, 10) ?? null;
  }

  private displayName(emailValue: string | null, ...values: (string | null | undefined)[]): string {
    const email = emailValue?.trim().toLowerCase();
    const emailUsername = email?.split('@')[0];
    for (const value of values) {
      const normalized = value?.trim().replace(/\s+/g, ' ');
      const lowerName = normalized?.toLowerCase();
      if (normalized && (!email || (lowerName !== email && lowerName !== emailUsername))) return normalized;
    }
    return 'Name not completed';
  }

  private reviewerName(reviewer: ReviewPrincipal): string {
    const name = reviewer.fullName?.trim().replace(/\s+/g, ' ');
    const email = reviewer.email?.trim().toLowerCase();
    const lowerName = name?.toLowerCase();
    if (!name || (email && (lowerName === email || lowerName === email.split('@')[0]))) {
      return 'Name not completed';
    }
    return name;
  }
}
