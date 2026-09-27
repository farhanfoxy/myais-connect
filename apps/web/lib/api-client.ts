import { validateBrowserEnvironment } from './config';

export interface CanonicalUser {
  id: string;
  email: string;
  fullName: string | null;
  photoUrl: string | null;
  role: string | null;
  accountStatus: string | null;
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
