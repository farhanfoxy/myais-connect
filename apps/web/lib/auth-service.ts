import { ApiClient, ApiError, type CanonicalUser } from './api-client';
import type { PendingRegistrationNameStore } from './pending-registration-name';
import { canonicalDestination, roleFamily } from './roles';

export interface BrowserSession {
  access_token: string;
}

interface AuthResult {
  data: { session: BrowserSession | null };
  error: { message?: string } | null;
}

export interface AuthGateway {
  signInWithPassword(credentials: { email: string; password: string }): Promise<AuthResult>;
  signUp(input: {
    email: string;
    password: string;
    options: { emailRedirectTo: string; data: { full_name: string } };
  }): Promise<AuthResult>;
  resetPasswordForEmail(email: string, options: { redirectTo: string }): Promise<{ error: unknown | null }>;
  updateUser(input: { password: string }): Promise<{ error: { message?: string } | null }>;
  exchangeCodeForSession(code: string): Promise<AuthResult>;
  getSession(): Promise<AuthResult>;
  signOut(options?: { scope: 'local' }): Promise<{ error: unknown | null }>;
}

export type CurrentAuthState =
  | { status: 'initializing' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: CanonicalUser }
  | { status: 'access-denied'; user?: CanonicalUser; message: string }
  | { status: 'api-unavailable'; message: string };

export type RegistrationResult =
  | { status: 'confirmation-required'; email: string }
  | CurrentAuthState;

export class SafeAuthError extends Error {}

export class CanonicalAuthService {
  constructor(
    private readonly auth: AuthGateway,
    private readonly apiForToken: (token: string) => Pick<ApiClient, 'getCurrentUser' | 'setRegistrationName'>,
    private readonly pendingNames?: PendingRegistrationNameStore,
  ) {}

  async current(): Promise<CurrentAuthState> {
    const result = await this.auth.getSession();
    if (result.error || !result.data.session) return { status: 'unauthenticated' };
    return this.resolve(result.data.session);
  }

  async signIn(email: string, password: string): Promise<CurrentAuthState> {
    const result = await this.auth.signInWithPassword({ email, password });
    if (result.error || !result.data.session) {
      throw new SafeAuthError('Email or password is incorrect. Please try again.');
    }
    return this.resolve(result.data.session);
  }

  async register(input: {
    fullName: string;
    email: string;
    password: string;
    emailRedirectTo: string;
  }): Promise<RegistrationResult> {
    const result = await this.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: input.emailRedirectTo,
        data: { full_name: input.fullName },
      },
    });
    if (result.error) throw new SafeAuthError('We could not create your account. Please try again.');
    this.pendingNames?.save({ fullName: input.fullName, email: input.email });
    if (!result.data.session) return { status: 'confirmation-required', email: input.email };
    return this.resolve(result.data.session);
  }

  async completeCallback(url: string): Promise<CurrentAuthState> {
    const parsed = new URL(url);
    if (parsed.searchParams.has('error') || parsed.searchParams.has('error_code')) {
      throw new SafeAuthError('This confirmation link is invalid or has expired.');
    }
    const code = parsed.searchParams.get('code');
    const existing = await this.auth.getSession();
    const result = existing.data.session || !code ? existing : await this.auth.exchangeCodeForSession(code);
    if (result.error || !result.data.session) {
      throw new SafeAuthError('We could not confirm your session. Please request a new link.');
    }
    return this.resolve(result.data.session);
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    try {
      await this.auth.resetPasswordForEmail(email, { redirectTo });
    } catch {
      // The caller always receives the same result to avoid account enumeration.
    }
  }

  async preparePasswordRecovery(url: string): Promise<boolean> {
    const parsed = new URL(url);
    if (parsed.searchParams.has('error') || parsed.searchParams.has('error_code')) return false;
    const code = parsed.searchParams.get('code');
    const recoveryHash = new URLSearchParams(parsed.hash.replace(/^#/, '')).get('type') === 'recovery';
    if (!code && !recoveryHash) return false;
    const existing = await this.auth.getSession();
    const result = existing.data.session || !code ? existing : await this.auth.exchangeCodeForSession(code);
    return !result.error && result.data.session !== null;
  }

  async updatePassword(password: string): Promise<void> {
    const result = await this.auth.updateUser({ password });
    if (result.error) throw new SafeAuthError('We could not update your password. Request a new reset link.');
  }

  async logout(): Promise<void> {
    await this.auth.signOut({ scope: 'local' });
  }

  private async resolve(session: BrowserSession): Promise<CurrentAuthState> {
    try {
      const api = this.apiForToken(session.access_token);
      const user = await api.getCurrentUser();
      if (user.accountStatus !== 'ACTIVE' || !roleFamily(user.role)) {
        return { status: 'access-denied', user, message: 'Your MyAIS account is not available for this area.' };
      }
      return { status: 'authenticated', user: await this.synchronizePendingName(api, user) };
    } catch (error) {
      if (error instanceof ApiError && error.kind === 'unauthorized') {
        await this.auth.signOut({ scope: 'local' });
        return { status: 'unauthenticated' };
      }
      if (error instanceof ApiError && error.kind === 'forbidden') {
        return { status: 'access-denied', message: 'Your MyAIS account is not active or cannot be accessed.' };
      }
      return { status: 'api-unavailable', message: 'We cannot reach MyAIS services right now. Please try again.' };
    }
  }

  private async synchronizePendingName(
    api: Pick<ApiClient, 'setRegistrationName'>,
    user: CanonicalUser,
  ): Promise<CanonicalUser> {
    const pending = this.pendingNames?.read();
    if (!pending) return user;
    if (pending.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      this.pendingNames?.clear();
      return user;
    }
    try {
      const result = await api.setRegistrationName(pending.fullName);
      this.pendingNames?.clear();
      return { ...user, fullName: result.fullName ?? user.fullName };
    } catch {
      return user;
    }
  }
}

export function destinationForState(state: CurrentAuthState): string {
  if (state.status === 'authenticated') return canonicalDestination(state.user.role);
  if (state.status === 'access-denied') return '/access-denied';
  return '/login';
}

export function protectedRouteDecision(state: CurrentAuthState): 'allow' | 'login' | 'deny' | 'wait' | 'unavailable' {
  if (state.status === 'authenticated') return 'allow';
  if (state.status === 'unauthenticated') return 'login';
  if (state.status === 'access-denied') return 'deny';
  if (state.status === 'api-unavailable') return 'unavailable';
  return 'wait';
}
