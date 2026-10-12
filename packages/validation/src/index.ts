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

export const registrationNameInputSchema = z.object({
  fullName: z.string().transform(value => value.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(2, 'Full Name must be at least 2 characters')),
}).strict();

export type RegistrationNameInput = z.infer<typeof registrationNameInputSchema>;

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

export const profilePhotoUploadSchema = z.object({
  originalFileName: z.string().refine(value => value.trim().length > 0, 'Required'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  fileSize: z.number().int().positive().max(5 * 1024 * 1024, 'Maximum 5MB allowed'),
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

export const paymentReceiptUploadSchema = privateUploadMetadataSchema;

export const paymentReceiptSubmissionSchema = z.object({
  uploadToken: z.string().min(1),
  paymentMethod: z.enum(['BANK_TRANSFER', 'ONLINE_BANKING', 'CASH_DEPOSIT']),
  bankName: z.string().optional().nullable(),
  transactionReference: z.string().transform(value => value.trim())
    .pipe(z.string().min(1, 'Transaction reference is required')),
  paidAt: calendarDate.optional().nullable(),
}).strict();

const paymentStatusSchema = z.enum([
  'NOT_SUBMITTED',
  'SUBMITTED',
  'UNDER_VERIFICATION',
  'VERIFIED',
  'REJECTED',
]);

export const reviewerPaymentQueueSchema = z.object({
  status: z.union([z.literal('ALL'), paymentStatusSchema]).default('ALL'),
  search: z.string().trim().max(200).default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(15),
}).strict();

export const reviewerPaymentRemarksSchema = z.object({
  treasurerRemarks: z.string().optional().default(''),
}).strict();

export const reviewerPaymentRejectSchema = z.object({
  remarks: z.string().refine(value => value.trim().length > 0, 'Remarks are required'),
}).strict();

export const eventCategorySchema = z.enum([
  'SEMINARS_AND_WEBINARS', 'WORKSHOPS', 'MEETINGS', 'MYDCIS', 'CONFERENCES', 'OTHER',
]);
export const eventStatusSchema = z.enum([
  'DRAFT', 'PUBLISHED', 'REGISTRATION_CLOSED', 'CANCELLED', 'COMPLETED', 'ARCHIVED',
]);

const eventTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time');
const optionalEventText = (maximum: number) => z.string().trim().max(maximum).optional().nullable();
const optionalEventUrl = z.string().trim().max(2048).url('Invalid URL')
  .refine(value => /^https?:\/\//i.test(value), 'Only HTTP(S) URLs are allowed').optional().nullable();

export const eventInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  category: eventCategorySchema,
  summary: optionalEventText(500),
  description: z.string().trim().min(1, 'Description is required').max(20_000),
  coverImage: optionalEventUrl,
  speakerName: optionalEventText(200),
  speakerTitle: optionalEventText(200),
  eventType: optionalEventText(100),
  venueType: z.enum(['PHYSICAL', 'ONLINE', 'HYBRID']),
  venueName: optionalEventText(300),
  physicalAddress: optionalEventText(1_000),
  onlineMeetingUrl: optionalEventUrl,
  startDate: calendarDate,
  startTime: eventTime,
  endDate: calendarDate.optional().nullable(),
  endTime: eventTime.optional().nullable(),
  registrationStart: calendarDate.optional().nullable(),
  registrationDeadline: calendarDate.optional().nullable(),
  capacity: z.number().nonnegative().finite().optional().nullable(),
  limitedSeats: z.boolean().default(false),
  memberFee: z.number().nonnegative().finite().default(0),
  nonMemberFee: z.number().nonnegative().finite().default(0),
  currency: z.string().trim().min(3).max(3).default('MYR'),
  paymentInstructions: optionalEventText(2_000),
  registrationUrl: optionalEventUrl,
  targetAudience: z.enum(['MEMBERS', 'NON_MEMBERS', 'MEMBERS_AND_NON_MEMBERS']).default('MEMBERS_AND_NON_MEMBERS'),
}).strict().superRefine((value, context) => {
  const start = `${value.startDate}T${value.startTime}`;
  if (value.endDate && value.endTime) {
    const end = `${value.endDate}T${value.endTime}`;
    if (end <= start) context.addIssue({ code: 'custom', path: ['endTime'], message: 'End must be after the event start' });
  }
  if (value.registrationStart && value.registrationDeadline && value.registrationStart > value.registrationDeadline) {
    context.addIssue({ code: 'custom', path: ['registrationDeadline'], message: 'Registration deadline must be on or after registration start' });
  }
  if (value.registrationDeadline && value.registrationDeadline > value.startDate) {
    context.addIssue({ code: 'custom', path: ['registrationDeadline'], message: 'Registration deadline must be before or on the event start date' });
  }
  if ((value.venueType === 'ONLINE' || value.venueType === 'HYBRID') && !value.onlineMeetingUrl) {
    context.addIssue({ code: 'custom', path: ['onlineMeetingUrl'], message: 'Online meeting URL is required for online or hybrid events' });
  }
  if ((value.venueType === 'PHYSICAL' || value.venueType === 'HYBRID') && !value.venueName) {
    context.addIssue({ code: 'custom', path: ['venueName'], message: 'Venue name is required' });
  }
  if ((value.venueType === 'PHYSICAL' || value.venueType === 'HYBRID') && !value.physicalAddress) {
    context.addIssue({ code: 'custom', path: ['physicalAddress'], message: 'Physical address is required' });
  }
});

export const memberEventQuerySchema = z.object({
  search: z.string().trim().max(200).default(''),
  category: z.union([z.literal('ALL'), eventCategorySchema]).default('ALL'),
  limit: z.coerce.number().int().min(1).max(100).default(100),
}).strict();

export const adminEventQuerySchema = z.object({
  search: z.string().trim().max(200).default(''),
  category: z.union([z.literal('ALL'), eventCategorySchema]).default('ALL'),
  status: z.union([z.literal('ALL'), eventStatusSchema]).default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(15),
}).strict();

export const cancelEventSchema = z.object({
  reason: z.string().trim().min(1, 'Cancellation reason is required').max(1_000),
}).strict();

export type EventInput = z.infer<typeof eventInputSchema>;

export const announcementCategorySchema = z.enum(['GENERAL', 'EVENT', 'MEMBERSHIP', 'POLICY', 'TRAINING']);
export const announcementAudienceSchema = z.enum(['ALL', 'MEMBERS', 'APPLICANTS', 'COMMITTEE']);
export const announcementStatusSchema = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']);

export const announcementInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  summary: z.string().trim().max(500).optional().nullable(),
  content: z.string().trim().min(1, 'Content is required').max(50_000),
  category: announcementCategorySchema.default('GENERAL'),
  targetAudience: announcementAudienceSchema.default('ALL'),
  expiryAt: z.string().datetime({ offset: true }).optional().nullable(),
}).strict();

export const adminAnnouncementQuerySchema = z.object({
  status: z.union([z.literal('ALL'), announcementStatusSchema]).default('ALL'),
  search: z.string().trim().max(200).default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(15),
}).strict();

export const notificationQuerySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).transform(value => value === 'true').default(false),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

export const reportTypeSchema = z.enum(['member-directory', 'membership', 'application', 'payment', 'event']);
export const reportFormatSchema = z.enum(['csv', 'xlsx']);
export const reportQuerySchema = z.object({
  format: reportFormatSchema.default('csv'),
  status: z.string().trim().max(80).optional(),
  membershipType: z.string().trim().max(80).optional(),
  from: calendarDate.optional(),
  to: calendarDate.optional(),
}).strict().refine(value => !value.from || !value.to || value.from <= value.to,
  { path: ['to'], message: 'End date must be on or after start date' });

export type AnnouncementInput = z.infer<typeof announcementInputSchema>;
export type ReportType = z.infer<typeof reportTypeSchema>;
