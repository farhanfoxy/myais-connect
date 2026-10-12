import { validateBrowserEnvironment } from './config';

export interface CanonicalUser {
  id: string;
  email: string;
  fullName: string | null;
  photoUrl: string | null;
  role: string | null;
  accountStatus: string | null;
}

export interface RegistrationNameResult {
  fullName: string | null;
  synchronized: boolean;
}

export interface MemberProfileFields {
  fullName: string | null;
  phoneNumber: string | null;
  identificationType: 'NRIC' | 'PASSPORT' | 'OTHER' | null;
  identificationNumber: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  institution: string | null;
  occupation: string | null;
  department: string | null;
  areaOfExpertise: string | null;
  aisMember: boolean;
  aisMembershipNumber: string | null;
  aisMembershipExpiry: string | null;
  profileCompletionPercentage: number;
}

export interface MemberProfileResponse { email: string; photoUrl: string | null; exists: boolean; profile: MemberProfileFields }

export interface MembershipApplicationSummary {
  id: string;
  applicationNumber: string | null;
  requestedMembershipType: { code: string; name: string | null } | null;
  recommendedMembershipType: { code: string; name: string | null } | null;
  status: string;
  currentStep: number | null;
  eligibilityScore: number | null;
  eligibilityExplanation: string | null;
  latestReviewerRemarks: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  documents: ApplicationDocument[];
  reviewHistory: Array<{ id: string; decision: string; remarks: string | null; reviewerName: string | null; createdAt: string }>;
  openInformationRequests: Array<{ id: string; requestedByName?: string | null; message: string; dueDate: string | null;
    status: string; createdAt?: string }>;
}

export interface EligibilityInput {
  malaysianCitizen?: boolean;
  dateOfBirth?: string;
  residingInMalaysia?: boolean;
  aisMember?: boolean;
  aisExpiry?: string;
  aisNumber?: string;
}

export interface EligibilityResult {
  recommendedTypeCode: 'ORDINARY' | 'ASSOCIATE';
  recommendedTypeName: string;
  explanation: string;
  score: number;
  selectableTypeCodes: Array<'ORDINARY' | 'LIFETIME' | 'ASSOCIATE'>;
}

export interface MembershipTypeOption {
  id: string;
  code: 'ORDINARY' | 'LIFETIME' | 'ASSOCIATE' | 'HONORARY';
  name: string;
  description: string | null;
  entranceFee: string | null;
  membershipFee: string | null;
}

export interface ReviewerMembershipTypeOption {
  id: string;
  code: string;
  name: string;
}

export interface ReviewerApplicationQueueItem {
  id: string;
  applicationNumber: string | null;
  applicantName: string;
  applicantEmail: string;
  requestedMembershipType: { code: string; name: string | null } | null;
  recommendedMembershipType: { code: string; name: string | null } | null;
  submittedAt: string | null;
  status: string;
  createdAt: string;
}

export interface ReviewerApplicationQueue {
  items: ReviewerApplicationQueueItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ReviewerApplicationDetail {
  id: string;
  applicationNumber: string | null;
  status: string;
  applicant: {
    displayName: string;
    email: string;
    nationality: string | null;
    dateOfBirth: string | null;
    institution: string | null;
    aisMember: boolean;
    aisMembershipNumber: string | null;
    aisMembershipExpiry: string | null;
  };
  requestedMembershipType: { code: string; name: string | null } | null;
  recommendedMembershipType: { code: string; name: string | null } | null;
  eligibilityScore: number | null;
  eligibilityExplanation: string | null;
  latestReviewerRemarks: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  documents: Array<{
    id: string;
    documentType: string;
    originalFileName: string | null;
    mimeType: string | null;
    fileSize: number | null;
    verificationStatus: string | null;
    reviewerRemarks: string | null;
    verifiedAt: string | null;
    createdAt: string;
    downloadAvailable: boolean;
  }>;
  reviewHistory: Array<{
    id: string;
    reviewerName: string | null;
    decision: string;
    remarks: string | null;
    previousStatus: string | null;
    newStatus: string | null;
    createdAt: string;
  }>;
}

export interface ReviewerPaymentQueueItem {
  id: string;
  paymentReference: string | null;
  applicantName: string;
  applicantEmail: string;
  applicationNumber: string | null;
  membershipType: { code: string; name: string | null } | null;
  totalAmount: string;
  currency: string | null;
  paymentMethod: string | null;
  submittedAt: string | null;
  status: string;
  createdAt: string;
}

export interface ReviewerPaymentQueue {
  items: ReviewerPaymentQueueItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ReviewerPaymentDetail {
  id: string;
  paymentReference: string | null;
  status: string;
  applicant: { displayName: string; email: string };
  application: {
    applicationNumber: string | null;
    status: string;
    approvedMembershipType: { code: string; name: string | null } | null;
  } | null;
  entranceFee: string | null;
  membershipFee: string | null;
  totalAmount: string;
  currency: string | null;
  paymentMethod: string | null;
  bankName: string | null;
  transactionReference: string | null;
  paidAt: string | null;
  submittedAt: string | null;
  rejectionReason: string | null;
  treasurerRemarks: string | null;
  verifiedAt: string | null;
  receiptDownloadAvailable: boolean;
}

export interface ReviewerPaymentMutationResult {
  id: string;
  status: string;
  applicationStatus: string;
  membershipNumber?: string | null;
  verifiedAt?: string;
  alreadyVerified?: boolean;
}

export type ApplicationDocumentType = 'IDENTIFICATION' | 'AIS_MEMBERSHIP_PROOF' | 'PROFILE_PHOTO' |
  'ADDITIONAL_SUPPORTING_DOCUMENT';

export interface ApplicationDocument {
  id: string;
  documentType: ApplicationDocumentType;
  originalFileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  verificationStatus: string | null;
  createdAt: string;
  downloadAvailable: boolean;
}

export interface PrivateUploadTarget {
  uploadToken: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

export interface PrivateDownloadTarget { downloadUrl: string; expiresAt: string }

export interface InformationResponseResult {
  id: string;
  status: 'RESPONDED';
  respondedAt: string;
  applicationStatus: 'UNDER_REVIEW';
  attachmentUploaded: boolean;
}

export interface CurrentPayment {
  applicationNumber: string | null;
  applicationStatus: string;
  approvedMembershipType: { code: string; name: string | null } | null;
  payment: {
    id: string;
    paymentReference: string | null;
    entranceFee: string | null;
    membershipFee: string | null;
    totalAmount: string;
    currency: string | null;
    paymentMethod: PaymentMethod | null;
    bankName: string | null;
    transactionReference: string | null;
    paidAt: string | null;
    status: string | null;
    submittedAt: string | null;
    treasurerRemarks: string | null;
    rejectionReason: string | null;
  } | null;
}

export type PaymentMethod = 'BANK_TRANSFER' | 'ONLINE_BANKING' | 'CASH_DEPOSIT';

export interface PaymentSubmissionResult {
  id: string;
  paymentReference: string | null;
  status: 'SUBMITTED';
  submittedAt: string;
  supersededReceiptCleanupPending: boolean;
}

export interface CurrentMembership {
  membershipNumber: string | null;
  membershipTypeCode: string | null;
  membershipTypeName: string | null;
  status: 'ACTIVE';
  startDate: string | null;
  expiryDate: string | null;
  votingEligible: boolean | null;
  activatedAt: string | null;
}

export interface AnnouncementRecord {
  id: string; title: string; summary: string | null; content: string; category: string | null;
  targetAudience: string | null; status: string | null; publishedAt: string | null; expiresAt: string | null;
  createdByName: string | null; createdAt: string; updatedAt: string;
}

export interface NotificationRecord {
  id: string; userId: string; eventType: string; type: string | null; title: string; message: string; actionUrl: string | null;
  isRead: boolean; readAt: string | null; createdAt: string;
}

export interface NotificationPage { items: NotificationRecord[]; page: number; pageSize: number; total: number; totalPages: number }
export interface AdminAnnouncementPage { items: AnnouncementRecord[]; page: number; pageSize: number; total: number; totalPages: number }

export type EventCategory = 'SEMINARS_AND_WEBINARS' | 'WORKSHOPS' | 'MEETINGS' | 'MYDCIS' | 'CONFERENCES' | 'OTHER';
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'REGISTRATION_CLOSED' | 'CANCELLED' | 'COMPLETED' | 'ARCHIVED';

export interface EventRecord {
  id: string;
  eventNumber: string | null;
  title: string;
  category: EventCategory;
  summary: string | null;
  description: string;
  coverImage: string | null;
  speakerName: string | null;
  speakerTitle: string | null;
  eventType: string | null;
  venueType: 'PHYSICAL' | 'ONLINE' | 'HYBRID';
  venueName: string | null;
  physicalAddress: string | null;
  startDate: string;
  startTime: string;
  endDate: string | null;
  endTime: string | null;
  registrationStart: string | null;
  registrationDeadline: string | null;
  capacity: number | null;
  limitedSeats: boolean | null;
  memberFee: string | null;
  nonMemberFee: string | null;
  currency: string | null;
  paymentInstructions: string | null;
  status: EventStatus;
  targetAudience: 'MEMBERS' | 'NON_MEMBERS' | 'MEMBERS_AND_NON_MEMBERS' | null;
  publishedAt: string | null;
  cancellationReason: string | null;
  placeholderImageNotice: boolean | null;
  timezone: string;
  registrationAvailable: boolean;
}

export interface AdminEventRecord extends EventRecord {
  slug: string | null;
  onlineMeetingUrl: string | null;
  registrationUrl: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
}

export interface EventInput {
  title: string;
  category: EventCategory;
  summary?: string | null;
  description: string;
  coverImage?: string | null;
  speakerName?: string | null;
  speakerTitle?: string | null;
  eventType?: string | null;
  venueType: 'PHYSICAL' | 'ONLINE' | 'HYBRID';
  venueName?: string | null;
  physicalAddress?: string | null;
  onlineMeetingUrl?: string | null;
  startDate: string;
  startTime: string;
  endDate?: string | null;
  endTime?: string | null;
  registrationStart?: string | null;
  registrationDeadline?: string | null;
  capacity?: number | null;
  limitedSeats: boolean;
  memberFee: number;
  nonMemberFee: number;
  currency: string;
  paymentInstructions?: string | null;
  registrationUrl?: string | null;
  targetAudience: 'MEMBERS' | 'NON_MEMBERS' | 'MEMBERS_AND_NON_MEMBERS';
}

export interface AdminEventQueue {
  items: AdminEventRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminDashboardResponse {
  viewer: { displayName: string; role: string };
  permissions: { reviewApplications: boolean; finalApproval: boolean; verifyPayments: boolean; manageEvents: boolean };
  kpis: {
    activeMembers: number; upcomingEvents: number; applicationsNeedingReview?: number;
    finalApprovals?: number; paymentsToVerify?: number;
  };
  charts: {
    membershipActivity?: Array<{ key: string; label: string; value: number }>;
    membershipDistribution?: Array<{ code: string; name: string; value: number }>;
    applicationPipeline?: Array<{ status: string; value: number }>;
    applicationActivity?: Array<{ key: string; label: string; value: number }>;
    paymentStatus?: Array<{ status: string; value: number }>;
  };
  attention: Array<{
    kind: 'APPLICATION' | 'PAYMENT'; id: string; reference: string | null; personName: string; status: string;
    waitingSince: string; waitingLabel: string; href: string; amount?: string; currency?: string;
  }>;
  upcomingEvents: Array<{
    id: string; eventNumber: string | null; title: string; startDate: string; startTime: string;
    venueType: string; venueName: string | null;
  }>;
  recentActivity: Array<{
    action: string; label: string; entityType: string | null; reference: string | null;
    actorName: string | null; createdAt: string;
  }>;
  operationalInsights: { membershipsExpiringSoon: number; windowDays: 30 };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly kind: 'unauthorized' | 'forbidden' | 'unavailable' | 'request',
    message: string,
  ) {
    super(message);
  }
}

export type AccessTokenProvider = () => Promise<string | null>;

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: AccessTokenProvider,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  getCurrentUser(): Promise<CanonicalUser> {
    return this.request<CanonicalUser>('/auth/me');
  }

  getAdminDashboard(): Promise<AdminDashboardResponse> { return this.request('/admin/dashboard'); }

  setRegistrationName(fullName: string): Promise<RegistrationNameResult> {
    return this.request<RegistrationNameResult>('/auth/me/name', {
      method: 'PUT', body: JSON.stringify({ fullName }),
    });
  }

  getProfile(): Promise<MemberProfileResponse> { return this.request('/profile'); }

  updateProfile(input: unknown): Promise<MemberProfileResponse> {
    return this.request('/profile', { method: 'PUT', body: JSON.stringify(input) });
  }

  authorizeProfilePhotoUpload(input: {
    originalFileName: string; mimeType: string; fileSize: number;
  }): Promise<PrivateUploadTarget> {
    return this.request('/profile/photo-upload', { method: 'POST', body: JSON.stringify(input) });
  }

  finalizeProfilePhotoUpload(uploadToken: string): Promise<MemberProfileResponse> {
    return this.request('/profile/photo-upload/finalize', {
      method: 'POST', body: JSON.stringify({ uploadToken }),
    });
  }

  getCurrentApplication(): Promise<MembershipApplicationSummary | null> {
    return this.request('/applications/current');
  }

  listApplications(): Promise<MembershipApplicationSummary[]> { return this.request('/applications'); }

  evaluateEligibility(input: EligibilityInput): Promise<EligibilityResult> {
    return this.request('/registration/eligibility', { method: 'POST', body: JSON.stringify(input) });
  }

  listMembershipTypes(): Promise<MembershipTypeOption[]> {
    return this.request('/registration/membership-types');
  }

  listReviewerMembershipTypes(): Promise<ReviewerMembershipTypeOption[]> {
    return this.request('/reviewer/membership-types');
  }

  listReviewerApplications(input: {
    page: number; pageSize: number; search: string; status: string;
  }): Promise<ReviewerApplicationQueue> {
    const query = new URLSearchParams({
      page: String(input.page), pageSize: String(input.pageSize), search: input.search, status: input.status,
    });
    return this.request(`/reviewer/applications?${query.toString()}`);
  }

  getReviewerApplication(id: string): Promise<ReviewerApplicationDetail> {
    return this.request(`/reviewer/applications/${encodeURIComponent(id)}`);
  }

  getReviewerDocumentDownload(applicationId: string, documentId: string): Promise<PrivateDownloadTarget> {
    return this.request(`/reviewer/applications/${encodeURIComponent(applicationId)}/documents/` +
      `${encodeURIComponent(documentId)}/download`);
  }

  startApplicationReview(id: string, remarks = ''): Promise<{ id: string; status: string; reviewedAt: string }> {
    return this.reviewerAction(id, 'start-review', { remarks });
  }

  requestApplicationInformation(id: string, input: { remarks: string; dueDate?: string | null }) {
    return this.reviewerAction(id, 'request-information', input);
  }

  recommendApplicationApproval(id: string, remarks = '') {
    return this.reviewerAction(id, 'recommend-approval', { remarks });
  }

  approveApplication(id: string, input: { approvedMembershipTypeId: string; remarks?: string }) {
    return this.reviewerAction(id, 'approve', input);
  }

  rejectApplication(id: string, remarks: string) {
    return this.reviewerAction(id, 'reject', { remarks });
  }

  listReviewerPayments(input: {
    page: number; pageSize: number; search: string; status: string;
  }): Promise<ReviewerPaymentQueue> {
    const query = new URLSearchParams({
      page: String(input.page), pageSize: String(input.pageSize), search: input.search, status: input.status,
    });
    return this.request(`/reviewer/payments?${query.toString()}`);
  }

  getReviewerPayment(id: string): Promise<ReviewerPaymentDetail> {
    return this.request(`/reviewer/payments/${encodeURIComponent(id)}`);
  }

  getReviewerPaymentReceiptDownload(id: string): Promise<PrivateDownloadTarget> {
    return this.request(`/reviewer/payments/${encodeURIComponent(id)}/receipt/download`);
  }

  verifyReviewerPayment(id: string, treasurerRemarks = ''): Promise<ReviewerPaymentMutationResult> {
    return this.request(`/reviewer/payments/${encodeURIComponent(id)}/verify`, {
      method: 'POST', body: JSON.stringify({ treasurerRemarks }),
    });
  }

  rejectReviewerPayment(id: string, remarks: string): Promise<ReviewerPaymentMutationResult> {
    return this.request(`/reviewer/payments/${encodeURIComponent(id)}/reject`, {
      method: 'POST', body: JSON.stringify({ remarks }),
    });
  }

  private reviewerAction<T = { id: string; status: string; reviewedAt?: string }>(
    id: string,
    action: string,
    input: unknown,
  ): Promise<T> {
    return this.request(`/reviewer/applications/${encodeURIComponent(id)}/${action}`, {
      method: 'POST', body: JSON.stringify(input),
    });
  }

  createApplicationDraft(input: { requestedMembershipTypeCode: string; eligibility: EligibilityInput }) {
    return this.request<MembershipApplicationSummary>('/applications/draft', {
      method: 'POST', body: JSON.stringify(input),
    });
  }

  getApplication(id: string): Promise<MembershipApplicationSummary> {
    return this.request(`/applications/${encodeURIComponent(id)}`);
  }

  listApplicationDocuments(applicationId: string): Promise<ApplicationDocument[]> {
    return this.request(`/applications/${encodeURIComponent(applicationId)}/documents`);
  }

  authorizeApplicationDocumentUpload(applicationId: string, input: {
    documentType: ApplicationDocumentType; originalFileName: string; mimeType: string; fileSize: number;
  }): Promise<PrivateUploadTarget> {
    return this.request(`/applications/${encodeURIComponent(applicationId)}/documents/uploads`, {
      method: 'POST', body: JSON.stringify(input),
    });
  }

  finalizeApplicationDocumentUpload(applicationId: string, uploadToken: string): Promise<ApplicationDocument> {
    return this.request(`/applications/${encodeURIComponent(applicationId)}/documents/uploads/finalize`, {
      method: 'POST', body: JSON.stringify({ uploadToken }),
    });
  }

  getApplicationDocumentDownload(applicationId: string, documentId: string): Promise<PrivateDownloadTarget> {
    return this.request(`/applications/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(documentId)}/download`);
  }

  deleteApplicationDocument(applicationId: string, documentId: string): Promise<{ deleted: true }> {
    return this.request(`/applications/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(documentId)}`, {
      method: 'DELETE',
    });
  }

  submitApplication(applicationId: string): Promise<MembershipApplicationSummary> {
    return this.request(`/applications/${encodeURIComponent(applicationId)}/submit`, {
      method: 'POST', body: JSON.stringify({ declarationAccepted: true }),
    });
  }

  authorizeInformationResponseUpload(applicationId: string, requestId: string, input: {
    originalFileName: string; mimeType: string; fileSize: number;
  }): Promise<PrivateUploadTarget> {
    return this.request(`/applications/${encodeURIComponent(applicationId)}/information-requests/` +
      `${encodeURIComponent(requestId)}/attachment-upload`, {
      method: 'POST', body: JSON.stringify(input),
    });
  }

  respondToInformationRequest(applicationId: string, requestId: string, input: {
    response: string; attachmentUploadToken?: string;
  }): Promise<InformationResponseResult> {
    return this.request(`/applications/${encodeURIComponent(applicationId)}/information-requests/` +
      `${encodeURIComponent(requestId)}/respond`, {
      method: 'POST', body: JSON.stringify(input),
    });
  }

  getCurrentPayment(): Promise<CurrentPayment | null> { return this.request('/payments/current'); }

  getCurrentMembership(): Promise<CurrentMembership | null> { return this.request('/memberships/current'); }

  listAnnouncements(): Promise<AnnouncementRecord[]> { return this.request('/announcements'); }
  getAnnouncement(id: string): Promise<AnnouncementRecord> { return this.request(`/announcements/${encodeURIComponent(id)}`); }
  listNotifications(input: { page?: number; pageSize?: number; unreadOnly?: boolean } = {}): Promise<NotificationPage> {
    const query = new URLSearchParams({ page: String(input.page ?? 1), pageSize: String(input.pageSize ?? 20),
      unreadOnly: String(input.unreadOnly ?? false) }); return this.request(`/notifications?${query.toString()}`);
  }
  getUnreadNotificationCount(): Promise<{ count: number }> { return this.request('/notifications/unread-count'); }
  markNotificationRead(id: string): Promise<NotificationRecord> {
    return this.request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', body: '{}' });
  }
  markAllNotificationsRead(): Promise<{ updated: number; readAt: string }> {
    return this.request('/notifications/read-all', { method: 'POST', body: '{}' });
  }
  listAdminAnnouncements(input: { page?: number; pageSize?: number; search?: string; status?: string } = {}): Promise<AdminAnnouncementPage> {
    const query = new URLSearchParams({ page: String(input.page ?? 1), pageSize: String(input.pageSize ?? 20),
      search: input.search ?? '', status: input.status ?? 'ALL' }); return this.request(`/admin/announcements?${query.toString()}`);
  }
  getAdminAnnouncement(id: string): Promise<AnnouncementRecord> { return this.request(`/admin/announcements/${encodeURIComponent(id)}`); }
  createAnnouncement(input: unknown): Promise<AnnouncementRecord> {
    return this.request('/admin/announcements', { method: 'POST', body: JSON.stringify(input) });
  }
  updateAnnouncement(id: string, input: unknown): Promise<AnnouncementRecord> {
    return this.request(`/admin/announcements/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) });
  }
  publishAnnouncement(id: string): Promise<AnnouncementRecord> {
    return this.request(`/admin/announcements/${encodeURIComponent(id)}/publish`, { method: 'POST', body: '{}' });
  }
  archiveAnnouncement(id: string): Promise<AnnouncementRecord> {
    return this.request(`/admin/announcements/${encodeURIComponent(id)}/archive`, { method: 'POST', body: '{}' });
  }
  downloadMembershipCard(): Promise<{ blob: Blob; filename: string }> { return this.download('/memberships/current/card'); }
  downloadReport(type: string, input: Record<string, string>): Promise<{ blob: Blob; filename: string }> {
    const query = new URLSearchParams(input); return this.download(`/admin/reports/${encodeURIComponent(type)}?${query.toString()}`);
  }

  listEvents(input: { search?: string; category?: string; limit?: number } = {}): Promise<EventRecord[]> {
    const query = new URLSearchParams();
    if (input.search) query.set('search', input.search);
    if (input.category) query.set('category', input.category);
    if (input.limit) query.set('limit', String(input.limit));
    const suffix = query.size ? `?${query.toString()}` : '';
    return this.request(`/events${suffix}`);
  }

  getEvent(id: string): Promise<EventRecord> { return this.request(`/events/${encodeURIComponent(id)}`); }

  listAdminEvents(input: { page: number; pageSize: number; search: string; category: string; status: string }): Promise<AdminEventQueue> {
    const query = new URLSearchParams({ page: String(input.page), pageSize: String(input.pageSize), search: input.search,
      category: input.category, status: input.status });
    return this.request(`/admin/events?${query.toString()}`);
  }

  getAdminEvent(id: string): Promise<AdminEventRecord> { return this.request(`/admin/events/${encodeURIComponent(id)}`); }

  createEvent(input: EventInput): Promise<AdminEventRecord> {
    return this.request('/admin/events', { method: 'POST', body: JSON.stringify(input) });
  }

  updateEvent(id: string, input: EventInput): Promise<AdminEventRecord> {
    return this.request(`/admin/events/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) });
  }

  publishEvent(id: string): Promise<AdminEventRecord> {
    return this.request(`/admin/events/${encodeURIComponent(id)}/publish`, { method: 'POST', body: '{}' });
  }

  cancelEvent(id: string, reason: string): Promise<AdminEventRecord> {
    return this.request(`/admin/events/${encodeURIComponent(id)}/cancel`, {
      method: 'POST', body: JSON.stringify({ reason }),
    });
  }

  authorizePaymentReceiptUpload(input: {
    originalFileName: string; mimeType: string; fileSize: number;
  }): Promise<PrivateUploadTarget> {
    return this.request('/payments/current/receipt-upload', {
      method: 'POST', body: JSON.stringify(input),
    });
  }

  finalizePaymentReceiptAndSubmit(input: {
    uploadToken: string;
    paymentMethod: PaymentMethod;
    bankName?: string;
    transactionReference: string;
    paidAt?: string;
  }): Promise<PaymentSubmissionResult> {
    return this.request('/payments/current/receipt-upload/finalize', {
      method: 'POST', body: JSON.stringify(input),
    });
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.accessToken();
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    if (init.body !== undefined) headers.set('content-type', 'application/json');
    if (token) headers.set('authorization', `Bearer ${token}`);
    let response: Response;
    try {
      const fetcher = this.fetcher;
      response = await fetcher(`${this.baseUrl}${path}`, { ...init, headers });
      if (response.status === 304 && (!init.method || init.method === 'GET')) {
        response = await fetcher(`${this.baseUrl}${path}`, { ...init, headers, cache: 'reload' });
      }
    } catch {
      throw new ApiError(0, 'unavailable', 'MyAIS services are temporarily unavailable. Please try again.');
    }
    if (!response.ok) throw safeApiError(response.status);
    if (response.status === 204) return null as T;
    let body: string;
    try {
      body = await response.text();
    } catch {
      throw new ApiError(0, 'unavailable', 'MyAIS returned an unexpected response. Please try again.');
    }
    if (!body.trim()) return null as T;
    try {
      return JSON.parse(body) as T;
    } catch {
      throw new ApiError(0, 'unavailable', 'MyAIS returned an unexpected response. Please try again.');
    }
  }

  private async download(path: string): Promise<{ blob: Blob; filename: string }> {
    const token = await this.accessToken(); const headers = new Headers({ accept: 'application/octet-stream' });
    if (token) headers.set('authorization', `Bearer ${token}`); let response: Response;
    try { const fetcher = this.fetcher; response = await fetcher(`${this.baseUrl}${path}`, { headers }); }
    catch { throw new ApiError(0, 'unavailable', 'MyAIS services are temporarily unavailable. Please try again.'); }
    if (!response.ok) throw safeApiError(response.status);
    const disposition = response.headers.get('content-disposition') ?? '';
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? 'myais-download';
    return { blob: await response.blob(), filename };
  }
}

export function createApiClient(accessToken: AccessTokenProvider, fetcher: typeof fetch = fetch): ApiClient {
  return new ApiClient(validateBrowserEnvironment().apiUrl, accessToken, fetcher);
}

function safeApiError(status: number): ApiError {
  if (status === 401) return new ApiError(status, 'unauthorized', 'Your session has expired. Please sign in again.');
  if (status === 403) return new ApiError(status, 'forbidden', 'This account does not have access to MyAIS.');
  if (status >= 500) return new ApiError(status, 'unavailable', 'MyAIS services are temporarily unavailable.');
  return new ApiError(status, 'request', 'We could not complete that request. Please try again.');
}
