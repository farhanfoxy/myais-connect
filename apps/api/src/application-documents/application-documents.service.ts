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
  applicationDocumentUploadSchema,
  finalizePrivateUploadSchema,
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
const downloadTtlSeconds = 5 * 60;

const documentSelect = {
  id: true,
  documentType: true,
  originalFileName: true,
  mimeType: true,
  fileSize: true,
  verificationStatus: true,
  createdAt: true,
  storageObjectKey: true,
} as const;

type DocumentRecord = {
  id: string;
  documentType: string;
  originalFileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  verificationStatus: string | null;
  createdAt: Date;
  storageObjectKey: string | null;
};

function safeDocument(document: DocumentRecord) {
  return {
    id: document.id,
    documentType: document.documentType,
    originalFileName: document.originalFileName,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    verificationStatus: document.verificationStatus,
    createdAt: document.createdAt.toISOString(),
    downloadAvailable: document.storageObjectKey !== null,
  };
}

@Injectable()
export class ApplicationDocumentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PRIVATE_STORAGE) private readonly storage: PrivateStorage,
  ) {}

  async initiateUpload(userId: string, applicationIdInput: string, input: unknown) {
    const applicationId = this.applicationId(applicationIdInput);
    const parsed = applicationDocumentUploadSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid document upload metadata');
    await this.ownDraftApplication(userId, applicationId);
    const objectKey = `applications/${applicationId}/${randomUUID()}`;
    try {
      return await this.storage.createUploadTarget({
        objectKey,
        contentType: parsed.data.mimeType,
        contentLength: parsed.data.fileSize,
        expiresInSeconds: uploadTtlSeconds,
        context: {
          kind: 'application-document',
          userId,
          applicationId,
          documentType: parsed.data.documentType,
          originalFileName: parsed.data.originalFileName,
          expectedMimeType: parsed.data.mimeType,
          expectedFileSize: String(parsed.data.fileSize),
        },
      });
    } catch (error) {
      this.storageFailure(error);
    }
  }

  async finalizeUpload(userId: string, applicationIdInput: string, input: unknown) {
    const applicationId = this.applicationId(applicationIdInput);
    const parsed = finalizePrivateUploadSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid upload finalization');
    let upload: ConfirmedPrivateUpload;
    try {
      upload = await this.storage.confirmUpload(parsed.data.uploadToken);
    } catch (error) {
      this.storageFailure(error);
    }
    if (upload.context.kind !== 'application-document' || upload.context.userId !== userId ||
      upload.context.applicationId !== applicationId) {
      throw new NotFoundException('Upload not found');
    }
    const metadata = applicationDocumentUploadSchema.safeParse({
      documentType: upload.context.documentType,
      originalFileName: upload.context.originalFileName,
      mimeType: upload.contentType,
      fileSize: upload.contentLength,
    });
    if (!metadata.success || upload.contentType !== upload.context.expectedMimeType ||
      String(upload.contentLength) !== upload.context.expectedFileSize) {
      await this.storage.deleteObject(upload.objectKey);
      throw new BadRequestException('Uploaded object metadata does not match authorization');
    }
    try {
      const created = await this.prisma.client.$transaction(async transaction => {
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${applicationId}, 2))::text AS "lock"`;
        const application = await transaction.membershipApplication.findFirst({
          where: { id: applicationId, userId }, select: { status: true },
        });
        if (!application) throw new NotFoundException('Application not found');
        if (application.status !== 'DRAFT') throw new ConflictException('Application documents are locked');
        return transaction.applicationDocument.create({
          data: {
            applicationId,
            userId,
            documentType: metadata.data.documentType,
            storageObjectKey: upload.objectKey,
            originalFileName: metadata.data.originalFileName,
            mimeType: metadata.data.mimeType,
            fileSize: metadata.data.fileSize,
            verificationStatus: 'PENDING',
          },
          select: documentSelect,
        });
      });
      return safeDocument(created);
    } catch (error) {
      await this.storage.deleteObject(upload.objectKey);
      throw error;
    }
  }

  async listOwn(userId: string, applicationIdInput: string) {
    const applicationId = this.applicationId(applicationIdInput);
    await this.ownApplication(userId, applicationId);
    const documents = await this.prisma.client.applicationDocument.findMany({
      where: { applicationId, userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: documentSelect,
    });
    return documents.map(safeDocument);
  }

  async downloadOwn(userId: string, applicationIdInput: string, documentIdInput: string) {
    const applicationId = this.applicationId(applicationIdInput);
    const documentId = this.documentId(documentIdInput);
    const document = await this.prisma.client.applicationDocument.findFirst({
      where: { id: documentId, applicationId, userId }, select: { storageObjectKey: true },
    });
    if (!document) throw new NotFoundException('Document not found');
    if (!document.storageObjectKey) {
      throw new ConflictException('Private download is unavailable for this legacy document');
    }
    try {
      return await this.storage.createDownloadTarget(document.storageObjectKey, downloadTtlSeconds);
    } catch (error) {
      this.storageFailure(error);
    }
  }

  async deleteOwn(userId: string, applicationIdInput: string, documentIdInput: string) {
    const applicationId = this.applicationId(applicationIdInput);
    const documentId = this.documentId(documentIdInput);
    let storageObjectKey: string | null = null;
    await this.prisma.client.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${applicationId}, 2))::text AS "lock"`;
      const document = await transaction.applicationDocument.findFirst({
        where: { id: documentId, applicationId, userId },
        select: { storageObjectKey: true, application: { select: { status: true } } },
      });
      if (!document) throw new NotFoundException('Document not found');
      if (document.application.status !== 'DRAFT') throw new ConflictException('Application documents are locked');
      storageObjectKey = document.storageObjectKey;
      if (storageObjectKey) {
        try {
          await this.storage.deleteObject(storageObjectKey);
        } catch (error) {
          this.storageFailure(error);
        }
      }
      await transaction.applicationDocument.delete({ where: { id: documentId } });
    });
    return { deleted: true };
  }

  private applicationId(input: string): string {
    const parsed = uuidPathSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid application ID');
    return parsed.data;
  }

  private documentId(input: string): string {
    const parsed = uuidPathSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid document ID');
    return parsed.data;
  }

  private async ownApplication(userId: string, applicationId: string): Promise<void> {
    const application = await this.prisma.client.membershipApplication.findFirst({
      where: { id: applicationId, userId }, select: { id: true },
    });
    if (!application) throw new NotFoundException('Application not found');
  }

  private async ownDraftApplication(userId: string, applicationId: string): Promise<void> {
    const application = await this.prisma.client.membershipApplication.findFirst({
      where: { id: applicationId, userId }, select: { status: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (application.status !== 'DRAFT') throw new ConflictException('Application documents are locked');
  }

  private storageFailure(error: unknown): never {
    if (error instanceof PrivateUploadNotFoundError) throw new BadRequestException(error.message);
    if (error instanceof PrivateStorageUnavailableError) throw new ServiceUnavailableException(error.message);
    throw error;
  }
}
