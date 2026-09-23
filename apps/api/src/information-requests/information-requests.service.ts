import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  finalizePrivateUploadSchema,
  informationRequestAttachmentUploadSchema,
  informationRequestResponseSchema,
  uuidPathSchema,
} from '@myais/validation';
import { PrismaService } from '../database/prisma.service.js';
import {
  PRIVATE_STORAGE,
  type ConfirmedPrivateUpload,
  type PrivateStorage,
  PrivateStorageUnavailableError,
  PrivateUploadNotFoundError,
} from '../storage/private-storage.js';

const uploadTtlSeconds = 5 * 60;

@Injectable()
export class InformationRequestsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PRIVATE_STORAGE) private readonly storage: PrivateStorage,
  ) {}

  async initiateAttachmentUpload(
    userId: string,
    applicationIdInput: string,
    requestIdInput: string,
    input: unknown,
  ) {
    const { applicationId, requestId } = this.ids(applicationIdInput, requestIdInput);
    const parsed = informationRequestAttachmentUploadSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid attachment upload metadata');
    await this.ownOpenRequest(userId, applicationId, requestId);
    try {
      return await this.storage.createUploadTarget({
        objectKey: `information-requests/${requestId}/${randomUUID()}`,
        contentType: parsed.data.mimeType,
        contentLength: parsed.data.fileSize,
        expiresInSeconds: uploadTtlSeconds,
        context: {
          kind: 'information-request-attachment',
          userId,
          applicationId,
          requestId,
          originalFileName: parsed.data.originalFileName,
          expectedMimeType: parsed.data.mimeType,
          expectedFileSize: String(parsed.data.fileSize),
        },
      });
    } catch (error) {
      this.storageFailure(error);
    }
  }

  async respond(userId: string, applicationIdInput: string, requestIdInput: string, input: unknown) {
    const { applicationId, requestId } = this.ids(applicationIdInput, requestIdInput);
    const parsed = informationRequestResponseSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid information-request response');
    let upload: ConfirmedPrivateUpload | null = null;
    if (parsed.data.attachmentUploadToken) {
      const token = finalizePrivateUploadSchema.parse({ uploadToken: parsed.data.attachmentUploadToken }).uploadToken;
      try {
        upload = await this.storage.confirmUpload(token);
      } catch (error) {
        this.storageFailure(error);
      }
      if (upload.context.kind !== 'information-request-attachment' || upload.context.userId !== userId ||
        upload.context.applicationId !== applicationId || upload.context.requestId !== requestId) {
        throw new NotFoundException('Attachment upload not found');
      }
      const metadata = informationRequestAttachmentUploadSchema.safeParse({
        originalFileName: upload.context.originalFileName,
        mimeType: upload.contentType,
        fileSize: upload.contentLength,
      });
      if (!metadata.success || upload.contentType !== upload.context.expectedMimeType ||
        String(upload.contentLength) !== upload.context.expectedFileSize) {
        await this.storage.deleteObject(upload.objectKey);
        throw new BadRequestException('Uploaded attachment metadata does not match authorization');
      }
    }
    try {
      const result = await this.prisma.client.$transaction(async transaction => {
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${applicationId}, 2))::text AS "lock"`;
        const application = await transaction.membershipApplication.findFirst({
          where: { id: applicationId, userId },
          select: {
            status: true,
            applicationNumber: true,
            user: { select: { fullName: true, legacyFullName: true, email: true } },
          },
        });
        if (!application) throw new NotFoundException('Application not found');
        if (application.status !== 'ADDITIONAL_INFORMATION_REQUIRED') {
          throw new ConflictException('Application is not awaiting additional information');
        }
        const request = await transaction.informationRequest.findFirst({
          where: { id: requestId, applicationId }, select: { status: true },
        });
        if (!request) throw new NotFoundException('Information request not found');
        if (request.status !== 'OPEN') throw new ConflictException('Information request is not open');
        const respondedAt = new Date();
        await transaction.informationRequest.update({
          where: { id: requestId },
          data: {
            applicantResponse: parsed.data.response,
            responseAttachmentObjectKey: upload?.objectKey,
            status: 'RESPONDED',
            respondedAt,
          },
        });
        await transaction.membershipApplication.update({
          where: { id: applicationId }, data: { status: 'UNDER_REVIEW' },
        });
        const actorName = this.displayName(
          application.user.fullName,
          application.user.legacyFullName,
          application.user.email,
        );
        await transaction.auditLog.create({
          data: {
            actorUserId: userId,
            actorName,
            action: 'INFO_RESPONSE_SUBMITTED',
            entityType: 'InformationRequest',
            description: `Applicant responded to information request for ${application.applicationNumber}`,
          },
        });
        return { id: requestId, status: 'RESPONDED', respondedAt: respondedAt.toISOString(),
          applicationStatus: 'UNDER_REVIEW', attachmentUploaded: upload !== null };
      });
      return result;
    } catch (error) {
      if (upload) await this.storage.deleteObject(upload.objectKey);
      throw error;
    }
  }

  private async ownOpenRequest(userId: string, applicationId: string, requestId: string): Promise<void> {
    const application = await this.prisma.client.membershipApplication.findFirst({
      where: { id: applicationId, userId }, select: { status: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (application.status !== 'ADDITIONAL_INFORMATION_REQUIRED') {
      throw new ConflictException('Application is not awaiting additional information');
    }
    const request = await this.prisma.client.informationRequest.findFirst({
      where: { id: requestId, applicationId }, select: { status: true },
    });
    if (!request) throw new NotFoundException('Information request not found');
    if (request.status !== 'OPEN') throw new ConflictException('Information request is not open');
  }

  private ids(applicationIdInput: string, requestIdInput: string) {
    const applicationId = uuidPathSchema.safeParse(applicationIdInput);
    const requestId = uuidPathSchema.safeParse(requestIdInput);
    if (!applicationId.success) throw new BadRequestException('Invalid application ID');
    if (!requestId.success) throw new BadRequestException('Invalid information request ID');
    return { applicationId: applicationId.data, requestId: requestId.data };
  }

  private displayName(...values: (string | null)[]): string {
    for (const value of values) {
      const normalized = value?.trim().replace(/\s+/g, ' ');
      if (normalized) return normalized;
    }
    return 'Applicant';
  }

  private storageFailure(error: unknown): never {
    if (error instanceof PrivateUploadNotFoundError) throw new BadRequestException(error.message);
    if (error instanceof PrivateStorageUnavailableError) throw new ServiceUnavailableException(error.message);
    throw error;
  }
}
