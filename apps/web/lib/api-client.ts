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
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  openInformationRequests: Array<{ id: string; message: string; dueDate: string | null; status: string }>;
}

export interface CurrentPayment {
  applicationNumber: string | null;
  applicationStatus: string;
  approvedMembershipType: { code: string; name: string | null } | null;
  payment: { status: string; paymentReference: string | null; totalAmount: string; currency: string } | null;
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

  getCurrentPayment(): Promise<CurrentPayment | null> { return this.request('/payments/current'); }

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
    } catch {
      throw new ApiError(0, 'unavailable', 'MyAIS services are temporarily unavailable. Please try again.');
    }
    if (!response.ok) throw safeApiError(response.status);
    if (response.status === 204) return undefined as T;
    try {
      return await response.json() as T;
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
