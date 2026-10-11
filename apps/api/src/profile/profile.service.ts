import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
  finalizePrivateUploadSchema,
  memberProfileInputSchema,
  profilePhotoUploadSchema,
  type MemberProfileInput,
} from '@myais/validation';
import { PrismaService } from '../database/prisma.service.js';
import {
  PRIVATE_STORAGE,
  type ConfirmedPrivateUpload,
  type PrivateStorage,
  PrivateStorageUnavailableError,
  PrivateUploadNotFoundError,
} from '../storage/private-storage.js';

const photoUrlTtlSeconds = 5 * 60;

const profileSelect = {
  fullName: true,
  phoneNumber: true,
  identificationType: true,
  identificationNumber: true,
  nationality: true,
  dateOfBirth: true,
  gender: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  postcode: true,
  country: true,
  institution: true,
  occupation: true,
  department: true,
  areaOfExpertise: true,
  aisMember: true,
  aisMembershipNumber: true,
  aisMembershipExpiry: true,
  profileCompletionPercentage: true,
} as const;

const completionFields: (keyof MemberProfileInput)[] = [
  'identificationType', 'identificationNumber', 'nationality', 'dateOfBirth', 'gender',
  'phoneNumber', 'addressLine1', 'city', 'state', 'postcode', 'country', 'institution',
  'occupation', 'department', 'areaOfExpertise',
];

function profileCompletion(value: Partial<Record<keyof MemberProfileInput, unknown>>): number {
  const filled = completionFields.filter(field => String(value[field] ?? '').trim().length > 0).length;
  return Math.round((filled / completionFields.length) * 100);
}

function dateOnly(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

function displayName(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    const normalized = value?.trim().replace(/\s+/g, ' ');
    if (normalized) return normalized;
  }
  return null;
}

@Injectable()
export class ProfileService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PRIVATE_STORAGE) private readonly storage: PrivateStorage,
  ) {}

  async getOwn(userId: string) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        fullName: true,
        legacyFullName: true,
        photoUrl: true,
        profilePhotoObjectKey: true,
        memberProfileByUser: { select: profileSelect },
      },
    });
    const profile = user.memberProfileByUser;
    return {
      email: user.email,
      photoUrl: await this.effectivePhotoUrl(user.profilePhotoObjectKey, user.photoUrl),
      exists: profile !== null,
      profile: {
        fullName: displayName(profile?.fullName, user.fullName, user.legacyFullName),
        phoneNumber: profile?.phoneNumber ?? null,
        identificationType: profile?.identificationType ?? null,
        identificationNumber: profile?.identificationNumber ?? null,
        nationality: profile?.nationality ?? null,
        dateOfBirth: dateOnly(profile?.dateOfBirth ?? null),
        gender: profile?.gender ?? null,
        addressLine1: profile?.addressLine1 ?? null,
        addressLine2: profile?.addressLine2 ?? null,
        city: profile?.city ?? null,
        state: profile?.state ?? null,
        postcode: profile?.postcode ?? null,
        country: profile?.country ?? null,
        institution: profile?.institution ?? null,
        occupation: profile?.occupation ?? null,
        department: profile?.department ?? null,
        areaOfExpertise: profile?.areaOfExpertise ?? null,
        aisMember: profile?.aisMember ?? false,
        aisMembershipNumber: profile?.aisMembershipNumber ?? null,
        aisMembershipExpiry: dateOnly(profile?.aisMembershipExpiry ?? null),
        profileCompletionPercentage: profile ? profileCompletion(profile) : 0,
      },
    };
  }

  async upsertOwn(userId: string, input: unknown) {
    const parsed = memberProfileInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Profile validation failed',
        errors: parsed.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })),
      });
    }
    const value = parsed.data;
    const completion = profileCompletion(value);
    await this.prisma.client.$transaction(async transaction => {
      const profile = await transaction.memberProfile.upsert({
        where: { userId },
        create: {
          userId,
          ...value,
          dateOfBirth: new Date(`${value.dateOfBirth}T00:00:00.000Z`),
          aisMembershipExpiry: value.aisMembershipExpiry
            ? new Date(`${value.aisMembershipExpiry}T00:00:00.000Z`) : null,
          profileCompletionPercentage: completion,
        },
        update: {
          ...value,
          dateOfBirth: new Date(`${value.dateOfBirth}T00:00:00.000Z`),
          aisMembershipExpiry: value.aisMembershipExpiry
            ? new Date(`${value.aisMembershipExpiry}T00:00:00.000Z`) : null,
          profileCompletionPercentage: completion,
        },
        select: { id: true },
      });
      await transaction.user.update({ where: { id: userId }, data: { fullName: value.fullName } });
      await transaction.eventRegistration.updateMany({ where: { userId }, data: { attendeeName: value.fullName } });
      await transaction.auditLog.create({
        data: {
          actorUserId: userId,
          actorName: value.fullName,
          action: 'PROFILE_NAME_SYNCED',
          entityType: 'MemberProfile',
          description: `Synchronized profile name to dependent records for ${value.fullName}`,
        },
      });
      return profile;
    });
    return this.getOwn(userId);
  }

  async initiatePhotoUpload(userId: string, input: unknown) {
    const parsed = profilePhotoUploadSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid profile photo metadata');
    try {
      return await this.storage.createUploadTarget({
        objectKey: `profiles/${userId}/${randomUUID()}`,
        contentType: parsed.data.mimeType,
        contentLength: parsed.data.fileSize,
        expiresInSeconds: photoUrlTtlSeconds,
        context: {
          kind: 'profile-photo', userId,
          originalFileName: parsed.data.originalFileName,
          expectedMimeType: parsed.data.mimeType,
          expectedFileSize: String(parsed.data.fileSize),
        },
      });
    } catch (error) {
      this.storageFailure(error);
    }
  }

  async finalizePhotoUpload(userId: string, input: unknown) {
    const parsed = finalizePrivateUploadSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid profile photo upload');
    let upload: ConfirmedPrivateUpload;
    try {
      upload = await this.storage.confirmUpload(parsed.data.uploadToken);
    } catch (error) {
      this.storageFailure(error);
    }
    const metadata = profilePhotoUploadSchema.safeParse({
      originalFileName: upload.context.originalFileName,
      mimeType: upload.contentType,
      fileSize: upload.contentLength,
    });
    if (upload.context.kind !== 'profile-photo' || upload.context.userId !== userId || !metadata.success ||
      upload.contentType !== upload.context.expectedMimeType ||
      String(upload.contentLength) !== upload.context.expectedFileSize) {
      await this.safeDelete(upload.objectKey);
      throw new NotFoundException('Upload not found');
    }
    let oldObjectKey: string | null = null;
    try {
      oldObjectKey = await this.prisma.client.$transaction(async transaction => {
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 8))::text AS "lock"`;
        const user = await transaction.user.findUnique({
          where: { id: userId }, select: { profilePhotoObjectKey: true },
        });
        if (!user) throw new NotFoundException('Profile not found');
        await transaction.user.update({
          where: { id: userId }, data: { profilePhotoObjectKey: upload.objectKey }, select: { id: true },
        });
        return user.profilePhotoObjectKey;
      });
    } catch (error) {
      await this.safeDelete(upload.objectKey);
      throw error;
    }
    if (oldObjectKey && oldObjectKey !== upload.objectKey) await this.safeDelete(oldObjectKey);
    return this.getOwn(userId);
  }

  private async effectivePhotoUrl(objectKey: string | null, legacyPhotoUrl: string | null): Promise<string | null> {
    if (!objectKey) return legacyPhotoUrl;
    try {
      return (await this.storage.createDownloadTarget(objectKey, photoUrlTtlSeconds)).downloadUrl;
    } catch {
      return legacyPhotoUrl;
    }
  }

  private async safeDelete(objectKey: string): Promise<void> {
    try { await this.storage.deleteObject(objectKey); } catch { /* Best-effort cleanup after database authority changes. */ }
  }

  private storageFailure(error: unknown): never {
    if (error instanceof PrivateUploadNotFoundError) throw new BadRequestException(error.message);
    if (error instanceof PrivateStorageUnavailableError) throw new ServiceUnavailableException(error.message);
    throw error;
  }
}
