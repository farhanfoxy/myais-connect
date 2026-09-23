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

const privateUploadMetadataSchema = z.object({
  originalFileName: z.string().refine(value => value.trim().length > 0, 'Required'),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  fileSize: z.number().int().positive().max(5 * 1024 * 1024, 'Maximum 5MB allowed'),
}).strict();

export const applicationDocumentUploadSchema = privateUploadMetadataSchema.extend({
  documentType: z.enum([
    'IDENTIFICATION',
    'AIS_MEMBERSHIP_PROOF',
    'PROFILE_PHOTO',
    'ADDITIONAL_SUPPORTING_DOCUMENT',
  ]),
}).strict();

export const finalizePrivateUploadSchema = z.object({
  uploadToken: z.string().min(1),
}).strict();

export const submitMembershipApplicationSchema = z.object({
  declarationAccepted: z.literal(true),
}).strict();

export const informationRequestAttachmentUploadSchema = privateUploadMetadataSchema;

export const informationRequestResponseSchema = z.object({
  response: z.string().refine(value => value.trim().length > 0, 'Response is required'),
  attachmentUploadToken: z.string().min(1).optional(),
}).strict();

export type ApplicationDocumentUploadInput = z.infer<typeof applicationDocumentUploadSchema>;
export type InformationRequestAttachmentUploadInput = z.infer<typeof informationRequestAttachmentUploadSchema>;

const reviewerApplicationStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'ADDITIONAL_INFORMATION_REQUIRED',
  'ELIGIBLE',
  'RECOMMENDED_FOR_APPROVAL',
  'APPROVED_PENDING_PAYMENT',
  'PAYMENT_SUBMITTED',
  'PAYMENT_UNDER_VERIFICATION',
  'ACTIVE',
  'REJECTED',
  'EXPIRED',
  'SUSPENDED',
  'TERMINATED',
]);

export const reviewerApplicationQueueSchema = z.object({
  status: z.union([z.literal('ALL'), reviewerApplicationStatusSchema]).default('ALL'),
  search: z.string().trim().max(200).default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(15),
}).strict();

export const reviewerOptionalRemarksSchema = z.object({
  remarks: z.string().optional().default(''),
}).strict();

export const reviewerRequestInformationSchema = z.object({
  remarks: z.string().refine(value => value.trim().length > 0, 'Remarks are required'),
  dueDate: calendarDate.optional().nullable(),
}).strict();

export const reviewerRejectSchema = z.object({
  remarks: z.string().refine(value => value.trim().length > 0, 'Remarks are required'),
}).strict();

export const reviewerApproveSchema = z.object({
  approvedMembershipTypeId: z.string().uuid('Invalid membership type ID'),
  remarks: z.string().optional().default(''),
}).strict();
