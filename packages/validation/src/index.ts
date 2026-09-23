import { z } from 'zod';

export { z };

const requiredProfileString = z.string().refine(value => value.trim().length > 0, {
  message: 'Required',
});

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').refine(value => {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, 'Invalid date');

export const memberProfileInputSchema = z.object({
  fullName: z.string().transform(value => value.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(2, 'Full Name must be at least 2 characters')),
  identificationType: z.enum(['NRIC', 'PASSPORT', 'OTHER']),
  identificationNumber: requiredProfileString,
  nationality: requiredProfileString,
  dateOfBirth: calendarDate,
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  phoneNumber: requiredProfileString,
  addressLine1: requiredProfileString,
  addressLine2: z.string().optional().nullable(),
  city: requiredProfileString,
  state: requiredProfileString,
  postcode: requiredProfileString,
  country: requiredProfileString,
  institution: requiredProfileString,
  occupation: requiredProfileString,
  department: requiredProfileString,
  areaOfExpertise: requiredProfileString,
  aisMember: z.boolean(),
  aisMembershipNumber: z.string().optional().nullable(),
  aisMembershipExpiry: calendarDate.optional().nullable(),
}).strict().superRefine((value, context) => {
  if (!value.aisMember) return;
  if (!value.aisMembershipNumber?.trim()) {
    context.addIssue({ code: 'custom', path: ['aisMembershipNumber'], message: 'Required for AIS members' });
  }
  if (!value.aisMembershipExpiry) {
    context.addIssue({ code: 'custom', path: ['aisMembershipExpiry'], message: 'Required for AIS members' });
  }
});

export type MemberProfileInput = z.infer<typeof memberProfileInputSchema>;

export const eligibilityOverridesSchema = z.object({
  malaysianCitizen: z.boolean().optional(),
  dateOfBirth: calendarDate.optional(),
  residingInMalaysia: z.boolean().optional(),
  aisMember: z.boolean().optional(),
  aisExpiry: calendarDate.optional(),
  aisNumber: z.string().optional(),
}).strict();

export const draftMembershipApplicationInputSchema = z.object({
  requestedMembershipTypeCode: z.enum(['ORDINARY', 'LIFETIME', 'ASSOCIATE', 'HONORARY']),
  eligibility: eligibilityOverridesSchema.optional(),
}).strict();

export const uuidPathSchema = z.string().uuid('Invalid application ID');

export type EligibilityOverrides = z.infer<typeof eligibilityOverridesSchema>;
export type DraftMembershipApplicationInput = z.infer<typeof draftMembershipApplicationInputSchema>;
