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
import { UserAccountStatus, UserRole } from '@myais/database';
import {
  reviewerPaymentQueueSchema,
  reviewerPaymentRejectSchema,
  reviewerPaymentRemarksSchema,
  uuidPathSchema,
} from '@myais/validation';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import { myaisBusinessYear } from '../membership-applications/membership-applications.service.js';
import {
  PRIVATE_STORAGE,
  type PrivateStorage,
  PrivateStorageUnavailableError,
  PrivateUploadNotFoundError,
} from '../storage/private-storage.js';

const downloadTtlSeconds = 5 * 60;
const verifierRoles = [UserRole.TREASURER, UserRole.SYSTEM_ADMINISTRATOR] as const;
const reviewablePaymentStatuses = ['SUBMITTED', 'UNDER_VERIFICATION'] as const;
const reviewableApplicationStatuses = ['PAYMENT_SUBMITTED', 'PAYMENT_UNDER_VERIFICATION'] as const;
const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kuala_Lumpur',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function paymentBusinessDate(value: Date): string {
  const parts = businessDateFormatter.formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value;
  const year = get('year');
  const month = get('month');
  const day = get('day');
  if (!year || !month || !day) throw new Error('Unable to derive MyAIS business date');
  return `${year}-${month}-${day}`;
}

export function paymentMembershipExpiry(startDate: string, validityMonths: number | null): string | null {
  if (!validityMonths || validityMonths <= 0) return null;
  const date = new Date(`${startDate}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + validityMonths);
  return date.toISOString().slice(0, 10);
}

const queueSelect = {
  id: true,
  paymentReference: true,
  totalAmount: true,
  currency: true,
  paymentMethod: true,
  submittedAt: true,
  status: true,
  createdAt: true,
  user: {
    select: {
      email: true,
      fullName: true,
      legacyFullName: true,
      memberProfileByUser: { select: { fullName: true } },
    },
  },
  application: {
    select: {
      applicationNumber: true,
      approvedMembershipTypeCode: true,
      approvedMembershipType: { select: { name: true } },
    },
  },
} satisfies Prisma.PaymentSelect;

const detailSelect = {
  id: true,
  paymentReference: true,
  entranceFee: true,
  membershipFee: true,
  totalAmount: true,
  currency: true,
  paymentMethod: true,
  bankName: true,
  transactionReference: true,
  paidAt: true,
  submittedAt: true,
  status: true,
  rejectionReason: true,
  treasurerRemarks: true,
  verifiedAt: true,
  receiptObjectKey: true,
  user: {
    select: {
      email: true,
      fullName: true,
      legacyFullName: true,
      memberProfileByUser: { select: { fullName: true } },
    },
  },
  application: {
    select: {
      applicationNumber: true,
      status: true,
      approvedMembershipTypeCode: true,
      approvedMembershipType: { select: { name: true } },
    },
  },
} satisfies Prisma.PaymentSelect;

type QueueRecord = Prisma.PaymentGetPayload<{ select: typeof queueSelect }>;
type DetailRecord = Prisma.PaymentGetPayload<{ select: typeof detailSelect }>;

@Injectable()
export class ReviewerPaymentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PRIVATE_STORAGE) private readonly storage: PrivateStorage,
  ) {}

  async list(input: unknown) {
    const parsed = reviewerPaymentQueueSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid payment queue query');
    const { page, pageSize, search, status } = parsed.data;
    const where: Prisma.PaymentWhereInput = {};
    if (status !== 'ALL') where.status = status;
    if (search) {
      where.OR = [
        { paymentReference: { contains: search, mode: 'insensitive' } },
        { application: { applicationNumber: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
        { user: { legacyFullName: { contains: search, mode: 'insensitive' } } },
        { user: { memberProfileByUser: { is: { fullName: { contains: search, mode: 'insensitive' } } } } },
      ];
    }
    const [records, total] = await this.prisma.client.$transaction([
      this.prisma.client.payment.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: queueSelect,
      }),
      this.prisma.client.payment.count({ where }),
    ]);
    return {
      items: records.map(record => this.safeQueue(record)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async detail(paymentIdInput: string) {
    const paymentId = this.id(paymentIdInput);
    const payment = await this.prisma.client.payment.findUnique({
      where: { id: paymentId },
      select: detailSelect,
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return this.safeDetail(payment);
  }

  async downloadReceipt(paymentIdInput: string) {
    const paymentId = this.id(paymentIdInput);
    const payment = await this.prisma.client.payment.findUnique({
      where: { id: paymentId },
      select: { receiptObjectKey: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (!payment.receiptObjectKey) {
      throw new ConflictException('Private download is unavailable for this legacy receipt');
    }
    try {
      return await this.storage.createDownloadTarget(payment.receiptObjectKey, downloadTtlSeconds);
    } catch (error) {
      if (error instanceof PrivateUploadNotFoundError) throw new NotFoundException('Private receipt not found');
      if (error instanceof PrivateStorageUnavailableError) throw new ServiceUnavailableException(error.message);
      throw error;
    }
  }

  async verify(verifier: CanonicalPrincipal, paymentIdInput: string, input: unknown) {
    this.authorizeVerifier(verifier);
    const parsed = reviewerPaymentRemarksSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid payment verification input');
    return this.mutatePayment(verifier, paymentIdInput, 'VERIFY', parsed.data.treasurerRemarks);
  }

  async reject(verifier: CanonicalPrincipal, paymentIdInput: string, input: unknown) {
    this.authorizeVerifier(verifier);
    const parsed = reviewerPaymentRejectSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Payment rejection remarks are required');
    return this.mutatePayment(verifier, paymentIdInput, 'REJECT', parsed.data.remarks);
  }

  private async mutatePayment(
    verifier: CanonicalPrincipal,
    paymentIdInput: string,
    action: 'VERIFY' | 'REJECT',
    remarks: string,
  ) {
    const paymentId = this.id(paymentIdInput);
    const target = await this.prisma.client.payment.findUnique({
      where: { id: paymentId },
      select: { applicationId: true },
    });
    if (!target) throw new NotFoundException('Payment not found');
    if (!target.applicationId) throw new ConflictException('Payment application is unavailable');
    const applicationId = target.applicationId;

    return this.prisma.client.$transaction(async transaction => {
      await this.lockPaymentPair(transaction, applicationId, paymentId);
      const payment = await transaction.payment.findUnique({
        where: { id: paymentId },
        select: {
          id: true,
          userId: true,
          applicationId: true,
          paymentReference: true,
          status: true,
          membershipId: true,
          application: {
            select: {
              id: true,
              userId: true,
              status: true,
              approvedMembershipTypeId: true,
              approvedMembershipTypeCode: true,
              approvedMembershipType: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  validityMonths: true,
                  votingRights: true,
                },
              },
            },
          },
        },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      const application = payment.application;
      if (!application || payment.applicationId !== applicationId || payment.userId !== application.userId) {
        throw new ConflictException('Payment ownership linkage is invalid');
      }
      if (payment.userId === verifier.id || application.userId === verifier.id) {
        throw new ForbiddenException('Verifiers cannot review their own payment');
      }

      const existingMembership = await transaction.membership.findUnique({
        where: { applicationId },
        select: { id: true, membershipNumber: true, status: true },
      });
      if (action === 'VERIFY' && payment.status === 'VERIFIED' && application.status === 'ACTIVE' &&
        existingMembership?.status === 'ACTIVE') {
        return {
          id: payment.id,
          status: 'VERIFIED',
          applicationStatus: 'ACTIVE',
          membershipNumber: existingMembership.membershipNumber,
          alreadyVerified: true,
        };
      }
      if (!reviewablePaymentStatuses.includes(payment.status as (typeof reviewablePaymentStatuses)[number]) ||
        !reviewableApplicationStatuses.includes(application.status as (typeof reviewableApplicationStatuses)[number])) {
        throw new ConflictException('Payment is not in a valid state for review');
      }
      if (existingMembership) throw new ConflictException('Application already has a Membership');

      const verifierName = this.displayName(verifier.email, verifier.fullName);
      if (action === 'REJECT') {
        await transaction.payment.update({
          where: { id: payment.id },
          data: { status: 'REJECTED', rejectionReason: remarks, treasurerRemarks: remarks },
        });
        await transaction.membershipApplication.update({
          where: { id: applicationId },
          data: { status: 'APPROVED_PENDING_PAYMENT' },
        });
        await transaction.notification.create({
          data: {
            userId: payment.userId,
            title: 'Payment Rejected',
            message: `Your payment has been rejected. Reason: ${remarks}. Please submit a new receipt.`,
            type: 'PAYMENT',
            actionUrl: '/my-application/payment',
          },
        });
        await this.createAudit(transaction, verifier, verifierName, payment.paymentReference, 'REJECT', remarks);
        return { id: payment.id, status: 'REJECTED', applicationStatus: 'APPROVED_PENDING_PAYMENT' };
      }

      const type = application.approvedMembershipType;
      if (!application.approvedMembershipTypeId || !type) {
        throw new ConflictException('Approved membership type is unavailable');
      }
      const role = this.memberRole(type.code);
      const verifiedAt = new Date();
      const startDateText = paymentBusinessDate(verifiedAt);
      const expiryDateText = paymentMembershipExpiry(startDateText, type.validityMonths);
      const membershipNumber = await this.nextMembershipNumber(transaction, myaisBusinessYear(verifiedAt));

      const membership = await transaction.membership.create({
        data: {
          membershipNumber,
          userId: payment.userId,
          applicationId,
          membershipTypeId: type.id,
          membershipTypeCode: application.approvedMembershipTypeCode || type.code,
          membershipTypeName: type.name,
          startDate: new Date(`${startDateText}T00:00:00.000Z`),
          expiryDate: expiryDateText ? new Date(`${expiryDateText}T00:00:00.000Z`) : null,
          status: 'ACTIVE',
          votingEligible: type.votingRights || false,
          activatedAt: verifiedAt,
        },
      });
      await transaction.payment.update({
        where: { id: payment.id },
        data: {
          status: 'VERIFIED',
          verifiedByUser: { connect: { id: verifier.id } },
          verifiedAt,
          treasurerRemarks: remarks,
        },
      });
      await transaction.membershipApplication.update({
        where: { id: applicationId },
        data: { status: 'ACTIVE' },
      });
      await transaction.user.update({ where: { id: payment.userId }, data: { role } });
      await transaction.notification.create({
        data: {
          userId: payment.userId,
          title: 'Membership Activated!',
          message: `Your ${type.name} membership (${membershipNumber}) is now active. ` +
            'View your digital membership card.',
          type: 'MEMBERSHIP',
          relatedEntityType: 'Membership',
          actionUrl: '/my-card',
        },
      });
      await this.createAudit(transaction, verifier, verifierName, payment.paymentReference, 'VERIFY', remarks);
      return {
        id: payment.id,
        status: 'VERIFIED',
        applicationStatus: 'ACTIVE',
        membershipId: membership.id,
        membershipNumber,
        verifiedAt: verifiedAt.toISOString(),
        alreadyVerified: false,
      };
    });
  }

  private async createAudit(
    transaction: Prisma.TransactionClient,
    verifier: CanonicalPrincipal,
    verifierName: string,
    paymentReference: string | null,
    action: 'VERIFY' | 'REJECT',
    remarks: string,
  ) {
    await transaction.auditLog.create({
      data: {
        actorUserId: verifier.id,
        actorName: verifierName,
        action: `PAYMENT_${action}`,
        entityType: 'Payment',
        description: `Payment ${paymentReference} ${action === 'VERIFY' ? 'verified' : 'rejected'}. Remarks: ${remarks}`,
      },
    });
  }

  private async nextMembershipNumber(transaction: Prisma.TransactionClient, year: number): Promise<string> {
    const prefix = `MYAIS-${year}-`;
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${prefix}, 5))::text AS "lock"`;
    const records = await transaction.membership.findMany({
      where: { membershipNumber: { startsWith: prefix } },
      select: { membershipNumber: true },
    });
    let highestSuffix = 0;
    const format = new RegExp(`^MYAIS-${year}-(\\d{6})$`);
    for (const record of records) {
      const match = record.membershipNumber?.match(format);
      if (match?.[1]) highestSuffix = Math.max(highestSuffix, Number(match[1]));
    }
    const nextSuffix = highestSuffix + 1;
    if (nextSuffix > 999999) throw new ConflictException('Membership number sequence exhausted');
    return `${prefix}${String(nextSuffix).padStart(6, '0')}`;
  }

  private async lockPaymentPair(transaction: Prisma.TransactionClient, applicationId: string, paymentId: string) {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${applicationId}, 2))::text AS "lock"`;
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${paymentId}, 6))::text AS "lock"`;
  }

  private memberRole(code: string): UserRole {
    switch (code) {
      case 'ORDINARY': return UserRole.ORDINARY_MEMBER;
      case 'LIFETIME': return UserRole.LIFETIME_MEMBER;
      case 'ASSOCIATE': return UserRole.ASSOCIATE_MEMBER;
      case 'HONORARY': return UserRole.HONORARY_MEMBER;
      default: throw new ConflictException('Approved membership type code is unsupported');
    }
  }

  private authorizeVerifier(verifier: CanonicalPrincipal) {
    if (verifier.accountStatus !== UserAccountStatus.ACTIVE ||
      !verifier.role || !verifierRoles.includes(verifier.role as (typeof verifierRoles)[number])) {
      throw new ForbiddenException('Insufficient role');
    }
  }

  private safeQueue(payment: QueueRecord) {
    return {
      id: payment.id,
      paymentReference: payment.paymentReference,
      applicantName: this.displayName(payment.user.email, payment.user.memberProfileByUser?.fullName,
        payment.user.fullName, payment.user.legacyFullName),
      applicantEmail: payment.user.email,
      applicationNumber: payment.application?.applicationNumber ?? null,
      membershipType: payment.application?.approvedMembershipTypeCode ? {
        code: payment.application.approvedMembershipTypeCode,
        name: payment.application.approvedMembershipType?.name ?? null,
      } : null,
      totalAmount: payment.totalAmount.toString(),
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      submittedAt: payment.submittedAt?.toISOString() ?? null,
      status: payment.status,
      createdAt: payment.createdAt.toISOString(),
    };
  }

  private safeDetail(payment: DetailRecord) {
    return {
      id: payment.id,
      paymentReference: payment.paymentReference,
      status: payment.status,
      applicant: {
        displayName: this.displayName(payment.user.email, payment.user.memberProfileByUser?.fullName,
          payment.user.fullName, payment.user.legacyFullName),
        email: payment.user.email,
      },
      application: payment.application ? {
        applicationNumber: payment.application.applicationNumber,
        status: payment.application.status,
        approvedMembershipType: payment.application.approvedMembershipTypeCode ? {
          code: payment.application.approvedMembershipTypeCode,
          name: payment.application.approvedMembershipType?.name ?? null,
        } : null,
      } : null,
      entranceFee: payment.entranceFee?.toString() ?? null,
      membershipFee: payment.membershipFee?.toString() ?? null,
      totalAmount: payment.totalAmount.toString(),
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      bankName: payment.bankName,
      transactionReference: payment.transactionReference,
      paidAt: payment.paidAt?.toISOString() ?? null,
      submittedAt: payment.submittedAt?.toISOString() ?? null,
      rejectionReason: payment.rejectionReason,
      treasurerRemarks: payment.treasurerRemarks,
      verifiedAt: payment.verifiedAt?.toISOString() ?? null,
      receiptDownloadAvailable: payment.receiptObjectKey !== null,
    };
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

  private id(input: string): string {
    const parsed = uuidPathSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid payment ID');
    return parsed.data;
  }
}
