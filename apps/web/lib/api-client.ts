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

export interface MemberProfileResponse { email: string; exists: boolean; profile: MemberProfileFields }

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

  setRegistrationName(fullName: string): Promise<RegistrationNameResult> {
    return this.request<RegistrationNameResult>('/auth/me/name', {
      method: 'PUT', body: JSON.stringify({ fullName }),
    });
  }

  getProfile(): Promise<MemberProfileResponse> { return this.request('/profile'); }

  updateProfile(input: unknown): Promise<MemberProfileResponse> {
    return this.request('/profile', { method: 'PUT', body: JSON.stringify(input) });
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
