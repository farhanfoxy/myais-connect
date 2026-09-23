import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { memberProfileInputSchema, type MemberProfileInput } from '@myais/validation';
import { PrismaService } from '../database/prisma.service.js';

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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getOwn(userId: string) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        fullName: true,
        legacyFullName: true,
        memberProfileByUser: { select: profileSelect },
      },
    });
    const profile = user.memberProfileByUser;
    return {
      email: user.email,
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
}
