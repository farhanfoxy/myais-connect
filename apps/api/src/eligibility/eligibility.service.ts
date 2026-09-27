import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { EligibilityOverrides } from '@myais/validation';
import { eligibilityOverridesSchema } from '@myais/validation';
import { PrismaService } from '../database/prisma.service.js';

export interface EligibilityProfile {
  nationality: string | null;
  dateOfBirth: Date | null;
  country: string | null;
  aisMember: boolean | null;
  aisMembershipExpiry: Date | null;
}

export interface EligibilityResult {
  recommendedTypeCode: 'ORDINARY' | 'ASSOCIATE';
  recommendedTypeName: 'Ordinary Member' | 'Associate Member';
  explanation: string;
  score: number;
  selectableTypeCodes: ('ORDINARY' | 'LIFETIME' | 'ASSOCIATE')[];
}

interface ProfileReader {
  memberProfile: {
    findUnique(args: {
      where: { userId: string };
      select: {
        nationality: true;
        dateOfBirth: true;
        country: true;
        aisMember: true;
        aisMembershipExpiry: true;
      };
    }): Promise<EligibilityProfile | null>;
  };
}

export function evaluateLegacyEligibility(
  profile: EligibilityProfile | null,
  answers: EligibilityOverrides,
  now = new Date(),
): EligibilityResult {
  const isMalaysian = Boolean(profile?.nationality?.toLowerCase().includes('malaysia')) ||
    Boolean(answers.malaysianCitizen);
  const dob = profile?.dateOfBirth ?? (answers.dateOfBirth ? new Date(`${answers.dateOfBirth}T00:00:00.000Z`) : null);
  const age = dob ? Math.floor((now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
  const isAdult = age >= 18;
  const inMalaysia = Boolean(profile?.country?.toLowerCase().includes('malaysia')) ||
    Boolean(answers.residingInMalaysia);
  const isAisMember = Boolean(profile?.aisMember) || Boolean(answers.aisMember);
  const aisExpiry = profile?.aisMembershipExpiry ??
    (answers.aisExpiry ? new Date(`${answers.aisExpiry}T00:00:00.000Z`) : null);
  const aisActive = aisExpiry ? aisExpiry.getTime() > now.getTime() : false;

  const explanations: string[] = [];
  if (!isMalaysian) explanations.push('Nationality: Not confirmed as Malaysian');
  if (!isAdult) explanations.push(`Age: ${age} years (minimum 18 required)`);
  if (!inMalaysia) explanations.push('Residence: Not confirmed as residing in Malaysia');
  if (!isAisMember) explanations.push('AIS Membership: Not an AIS member');
  if (!aisActive) explanations.push('AIS Membership: Expired or not provided');

  if (explanations.length === 0) {
    return {
      recommendedTypeCode: 'ORDINARY',
      recommendedTypeName: 'Ordinary Member',
      explanation: 'All requirements satisfied. You are eligible for Ordinary or Lifetime membership.',
      score: 100,
      selectableTypeCodes: ['ORDINARY', 'LIFETIME'],
    };
  }
  return {
    recommendedTypeCode: 'ASSOCIATE',
    recommendedTypeName: 'Associate Member',
    explanation: `Associate membership recommended. Issues: ${explanations.join('; ')}`,
    score: Math.max(0, 100 - explanations.length * 20),
    selectableTypeCodes: ['ASSOCIATE'],
  };
}

@Injectable()
export class EligibilityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  parseOverrides(input: unknown): EligibilityOverrides {
    const parsed = eligibilityOverridesSchema.safeParse(input ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Eligibility input validation failed',
        errors: parsed.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })),
      });
    }
    return parsed.data;
  }

  async evaluateOwn(userId: string, input: unknown): Promise<EligibilityResult> {
    return this.evaluateWithClient(this.prisma.client, userId, this.parseOverrides(input));
  }

  async evaluateWithClient(
    client: ProfileReader,
    userId: string,
    answers: EligibilityOverrides,
    now = new Date(),
  ): Promise<EligibilityResult> {
    const profile = await client.memberProfile.findUnique({
      where: { userId },
      select: {
        nationality: true,
        dateOfBirth: true,
        country: true,
        aisMember: true,
        aisMembershipExpiry: true,
      },
    });
    return evaluateLegacyEligibility(profile, answers, now);
  }
}
