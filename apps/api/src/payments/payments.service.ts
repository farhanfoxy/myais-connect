import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '@myais/database';
import { Prisma as PrismaRuntime } from '@myais/database';
import {
  paymentReceiptSubmissionSchema,
  paymentReceiptUploadSchema,
} from '@myais/validation';
import { PrismaService } from '../database/prisma.service.js';
import { myaisBusinessYear } from '../membership-applications/membership-applications.service.js';
import {
  PRIVATE_STORAGE,
  type ConfirmedPrivateUpload,
  type PrivateStorage,
  PrivateStorageUnavailableError,
  PrivateUploadNotFoundError,
} from '../storage/private-storage.js';

const uploadTtlSeconds = 5 * 60;
const pendingApplicationStatuses = [
  'APPROVED_PENDING_PAYMENT',
  'PAYMENT_SUBMITTED',
  'PAYMENT_UNDER_VERIFICATION',
] as const;

const currentSelect = {
  applicationNumber: true,
  status: true,
  approvedMembershipTypeCode: true,
  approvedMembershipType: { select: { name: true } },
  paymentByApplication: {
    select: {
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
      status: true,
      submittedAt: true,
      treasurerRemarks: true,
      rejectionReason: true,
    },
  },
} satisfies Prisma.MembershipApplicationSelect;

type CurrentRecord = Prisma.MembershipApplicationGetPayload<{ select: typeof currentSelect }>;

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PRIVATE_STORAGE) private readonly storage: PrivateStorage,
  ) {}

  async currentOwn(userId: string) {
    const record = await this.prisma.client.membershipApplication.findFirst({
      where: {
        userId,
        OR: [
          { status: { in: [...pendingApplicationStatuses] } },
          { status: 'ACTIVE', paymentByApplication: { is: { status: 'VERIFIED' } } },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: currentSelect,
    });
    return record ? this.safeCurrent(record) : null;
  }

  async initiateReceiptUpload(userId: string, input: unknown) {
    const parsed = paymentReceiptUploadSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid payment receipt metadata');
    const payment = await this.ensureSubmittablePayment(userId);
    if (!payment.applicationId) throw new ConflictException('Payment application is unavailable');
    const objectKey = `payments/${payment.id}/${randomUUID()}`;
    try {
      return await this.storage.createUploadTarget({
        objectKey,
        contentType: parsed.data.mimeType,
        contentLength: parsed.data.fileSize,
        expiresInSeconds: uploadTtlSeconds,
        context: {
          kind: 'payment-receipt',
          userId,
          applicationId: payment.applicationId,
          paymentId: payment.id,
          originalFileName: parsed.data.originalFileName,
          expectedMimeType: parsed.data.mimeType,
          expectedFileSize: String(parsed.data.fileSize),
        },
      });
    } catch (error) {
      this.storageFailure(error);
    }
  }

  async finalizeReceiptAndSubmit(userId: string, input: unknown) {
    const parsed = paymentReceiptSubmissionSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid payment submission');
    let upload: ConfirmedPrivateUpload;
    try {
      upload = await this.storage.confirmUpload(parsed.data.uploadToken);
    } catch (error) {
      this.storageFailure(error);
    }
    if (upload.context.kind !== 'payment-receipt' || upload.context.userId !== userId ||
      !upload.context.applicationId || !upload.context.paymentId) {
      await this.safeDelete(upload.objectKey);
      throw new NotFoundException('Upload not found');
    }
    const metadata = paymentReceiptUploadSchema.safeParse({
      originalFileName: upload.context.originalFileName,
      mimeType: upload.contentType,
      fileSize: upload.contentLength,
    });
    if (!metadata.success || upload.contentType !== upload.context.expectedMimeType ||
      String(upload.contentLength) !== upload.context.expectedFileSize) {
      await this.safeDelete(upload.objectKey);
      throw new BadRequestException('Uploaded object metadata does not match authorization');
    }

    const { applicationId, paymentId } = upload.context;
    let result: { payment: ReturnType<PaymentsService['safeSubmittedPayment']>; oldObjectKey: string | null };
    try {
      result = await this.prisma.client.$transaction(async transaction => {
        await this.lockPaymentPair(transaction, applicationId, paymentId);
        const payment = await transaction.payment.findFirst({
          where: { id: paymentId, userId, applicationId },
          select: {
            id: true,
            paymentReference: true,
            status: true,
            receiptObjectKey: true,
            application: {
              select: {
                id: true,
                status: true,
                applicationNumber: true,
                userId: true,
                user: {
                  select: {
                    email: true,
                    fullName: true,
                    legacyFullName: true,
                    memberProfileByUser: { select: { fullName: true } },
                  },
                },
              },
            },
          },
        });
        if (!payment || !payment.application || payment.application.userId !== userId) {
          throw new NotFoundException('Payment not found');
        }
        if (payment.application.status !== 'APPROVED_PENDING_PAYMENT' ||
          (payment.status !== 'NOT_SUBMITTED' && payment.status !== 'REJECTED')) {
          throw new ConflictException('Payment is not in a valid state for submission');
        }
        const submittedAt = new Date();
        const wasRejected = payment.status === 'REJECTED';
        await transaction.payment.update({
          where: { id: payment.id },
          data: {
            paymentMethod: parsed.data.paymentMethod,
            bankName: parsed.data.bankName ?? null,
            transactionReference: parsed.data.transactionReference,
            receiptObjectKey: upload.objectKey,
            paidAt: parsed.data.paidAt
              ? new Date(`${parsed.data.paidAt}T00:00:00.000Z`)
              : submittedAt,
            submittedAt,
            status: 'SUBMITTED',
            ...(wasRejected ? {
              rejectionReason: null,
              treasurerRemarks: null,
              verifiedByUser: { disconnect: true },
              verifiedAt: null,
            } : {}),
          },
        });
        await transaction.membershipApplication.update({
          where: { id: applicationId },
          data: { status: 'PAYMENT_SUBMITTED' },
        });
        await transaction.auditLog.create({
          data: {
            actorUserId: userId,
            actorName: this.displayName(payment.application.user),
            action: 'PAYMENT_SUBMITTED',
            entityType: 'Payment',
            description: `Payment submitted for application ${payment.application.applicationNumber}`,
          },
        });
        return {
          oldObjectKey: payment.receiptObjectKey,
          payment: this.safeSubmittedPayment(payment.id, payment.paymentReference, submittedAt),
        };
      });
    } catch (error) {
      await this.safeDelete(upload.objectKey);
      throw error;
    }

    let supersededReceiptCleanupPending = false;
    if (result.oldObjectKey && result.oldObjectKey !== upload.objectKey) {
      try {
        await this.storage.deleteObject(result.oldObjectKey);
      } catch {
        supersededReceiptCleanupPending = true;
      }
    }
    return { ...result.payment, supersededReceiptCleanupPending };
  }

  private async ensureSubmittablePayment(userId: string) {
    return this.prisma.client.$transaction(async transaction => {
      const application = await transaction.membershipApplication.findFirst({
        where: { userId, status: 'APPROVED_PENDING_PAYMENT' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          userId: true,
          approvedMembershipTypeId: true,
          approvedMembershipType: {
            select: { id: true, code: true, entranceFee: true, membershipFee: true },
          },
          paymentByApplication: { select: { id: true, applicationId: true, status: true } },
        },
      });
      if (!application) throw new NotFoundException('Payment application not found');
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${application.id}, 2))::text AS "lock"`;
      const locked = await transaction.membershipApplication.findFirst({
        where: { id: application.id, userId },
        select: {
          id: true,
          userId: true,
          status: true,
          approvedMembershipTypeId: true,
          approvedMembershipType: {
            select: { id: true, code: true, entranceFee: true, membershipFee: true },
          },
          paymentByApplication: { select: { id: true, applicationId: true, status: true } },
        },
      });
      if (!locked) throw new NotFoundException('Payment application not found');
      if (locked.status !== 'APPROVED_PENDING_PAYMENT') {
        throw new ConflictException('Application is not awaiting payment');
      }
      if (locked.paymentByApplication) {
        if (locked.paymentByApplication.status !== 'NOT_SUBMITTED' &&
          locked.paymentByApplication.status !== 'REJECTED') {
          throw new ConflictException('Payment is not open for submission');
        }
        return locked.paymentByApplication;
      }
      const type = locked.approvedMembershipType;
      if (!locked.approvedMembershipTypeId || !type) {
        throw new ConflictException('Approved membership type is unavailable');
      }
      if (type.code === 'HONORARY') {
        throw new ConflictException('Honorary applications do not use payment submission');
      }
      const paymentReference = await this.nextPaymentReference(transaction, myaisBusinessYear(new Date()));
      const entranceFee = type.entranceFee ?? new PrismaRuntime.Decimal(0);
      const membershipFee = type.membershipFee ?? new PrismaRuntime.Decimal(0);
      return transaction.payment.create({
        data: {
          paymentReference,
          userId,
          applicationId: locked.id,
          paymentType: type.code === 'LIFETIME' ? 'ENTRANCE_AND_LIFETIME' : 'ENTRANCE_AND_ANNUAL',
          entranceFee,
          membershipFee,
          totalAmount: entranceFee.plus(membershipFee),
          currency: 'MYR',
          status: 'NOT_SUBMITTED',
        },
        select: { id: true, applicationId: true, status: true },
      });
    });
  }

  private async nextPaymentReference(transaction: Prisma.TransactionClient, year: number): Promise<string> {
    const prefix = `MYAIS-PAY-${year}-`;
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${prefix}, 4))::text AS "lock"`;
    const records = await transaction.payment.findMany({
      where: { paymentReference: { startsWith: prefix } },
      select: { paymentReference: true },
    });
    let highestSuffix = 0;
    const format = new RegExp(`^MYAIS-PAY-${year}-(\\d{6})$`);
    for (const record of records) {
      const match = record.paymentReference?.match(format);
      if (match?.[1]) highestSuffix = Math.max(highestSuffix, Number(match[1]));
    }
    const nextSuffix = highestSuffix + 1;
    if (nextSuffix > 999999) throw new ConflictException('Payment number sequence exhausted');
    return `${prefix}${String(nextSuffix).padStart(6, '0')}`;
  }

  private async lockPaymentPair(transaction: Prisma.TransactionClient, applicationId: string, paymentId: string) {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${applicationId}, 2))::text AS "lock"`;
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${paymentId}, 6))::text AS "lock"`;
  }

  private safeCurrent(record: CurrentRecord) {
    const payment = record.paymentByApplication;
    return {
      applicationNumber: record.applicationNumber,
      applicationStatus: record.status,
      approvedMembershipType: record.approvedMembershipTypeCode ? {
        code: record.approvedMembershipTypeCode,
        name: record.approvedMembershipType?.name ?? null,
      } : null,
      payment: payment ? {
        id: payment.id,
        paymentReference: payment.paymentReference,
        entranceFee: payment.entranceFee?.toString() ?? null,
        membershipFee: payment.membershipFee?.toString() ?? null,
        totalAmount: payment.totalAmount.toString(),
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        bankName: payment.bankName,
        transactionReference: payment.transactionReference,
        paidAt: payment.paidAt?.toISOString() ?? null,
        status: payment.status,
        submittedAt: payment.submittedAt?.toISOString() ?? null,
        treasurerRemarks: payment.treasurerRemarks,
        rejectionReason: payment.rejectionReason,
      } : null,
    };
  }

  private safeSubmittedPayment(id: string, paymentReference: string | null, submittedAt: Date) {
    return { id, paymentReference, status: 'SUBMITTED' as const, submittedAt: submittedAt.toISOString() };
  }

  private displayName(user: {
    email: string | null;
    fullName: string | null;
    legacyFullName: string | null;
    memberProfileByUser: { fullName: string | null } | null;
  }): string {
    const email = user.email?.trim().toLowerCase();
    const emailUsername = email?.split('@')[0];
    for (const value of [user.memberProfileByUser?.fullName, user.fullName, user.legacyFullName]) {
      const normalized = value?.trim().replace(/\s+/g, ' ');
      const lowerName = normalized?.toLowerCase();
      if (normalized && (!email || (lowerName !== email && lowerName !== emailUsername))) return normalized;
    }
    return 'Applicant';
  }

  private async safeDelete(objectKey: string): Promise<void> {
    try {
      await this.storage.deleteObject(objectKey);
    } catch {
      // Database state remains authoritative; external cleanup is best effort.
    }
  }

  private storageFailure(error: unknown): never {
    if (error instanceof PrivateUploadNotFoundError) throw new BadRequestException(error.message);
    if (error instanceof PrivateStorageUnavailableError) throw new ServiceUnavailableException(error.message);
    throw error;
  }
}
