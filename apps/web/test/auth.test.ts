import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError, type CanonicalUser } from '@/lib/api-client';
import {
  CanonicalAuthService,
  SafeAuthError,
  destinationForState,
  protectedRouteDecision,
  type AuthGateway,
  type BrowserSession,
} from '@/lib/auth-service';
import {
  normalizeFullName,
  validateEmail,
  validateLogin,
  validatePasswordReset,
  validateRegistration,
} from '@/lib/auth-validation';
import { canonicalDestination } from '@/lib/roles';
import {
  createPendingRegistrationNameStore,
  type PendingRegistrationNameStore,
} from '@/lib/pending-registration-name';

const session: BrowserSession = { access_token: 'private-access-token' };
const applicant: CanonicalUser = {
  id: 'user-1',
  email: 'member@example.test',
  fullName: 'Aisyah Rahman',
  photoUrl: null,
  role: 'APPLICANT',
  accountStatus: 'ACTIVE',
};

function authGateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    signInWithPassword: vi.fn(async () => ({ data: { session }, error: null })),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    exchangeCodeForSession: vi.fn(async () => ({ data: { session }, error: null })),
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    ...overrides,
  };
}

function pendingStore(record: { fullName: string; email: string; createdAt: number } | null = null) {
  let current = record;
  const store: PendingRegistrationNameStore = {
    save: vi.fn(input => { current = { ...input, createdAt: Date.now() }; }),
    read: vi.fn(() => current),
    clear: vi.fn(() => { current = null; }),
  };
  return store;
}

function service(user: CanonicalUser = applicant, gateway = authGateway(), names?: PendingRegistrationNameStore) {
  const getCurrentUser = vi.fn(async () => user);
  const setRegistrationName = vi.fn(async (fullName: string) => ({ fullName, synchronized: true }));
  return {
    gateway,
    getCurrentUser,
    setRegistrationName,
    value: new CanonicalAuthService(gateway, () => ({ getCurrentUser, setRegistrationName }), names),
  };
}

describe('form validation', () => {
  it('validates login without sending malformed credentials', () => {
    expect(validateLogin('not-an-email', '').errors).toEqual({
      email: 'Enter a valid email address.',
      password: 'Enter your password.',
    });
    expect(validateLogin(' Member@Example.Test ', 'secret').data).toEqual({
      email: 'member@example.test',
      password: 'secret',
    });
  });

  it('normalizes registration names and rejects mismatched passwords', () => {
    expect(normalizeFullName('  Nur   Aina  ')).toBe('Nur Aina');
    expect(validateRegistration({ fullName: ' A ', email: 'member@example.test', password: 'one',
      confirmPassword: 'two' }).errors).toMatchObject({
      fullName: 'Full name must be at least 2 characters.',
      confirmPassword: 'Passwords do not match.',
    });
  });

  it('validates forgot-password email and reset-password confirmation', () => {
    expect(validateEmail('bad').errors.email).toBeTruthy();
    expect(validatePasswordReset('one', 'two').errors.confirmPassword).toBe('Passwords do not match.');
    expect(validatePasswordReset('new-password', 'new-password').data).toEqual({ password: 'new-password' });
  });
});

describe('canonical authentication flow', () => {
  it('signs in then calls /auth/me before routing an applicant', async () => {
    const fixture = service();
    const state = await fixture.value.signIn('member@example.test', 'secret');
    expect(fixture.gateway.signInWithPassword).toHaveBeenCalledWith({
      email: 'member@example.test', password: 'secret',
    });
    expect(fixture.getCurrentUser).toHaveBeenCalledOnce();
    expect(state).toEqual({ status: 'authenticated', user: applicant });
    expect(destinationForState(state)).toBe('/dashboard');
  });

  it('returns a safe failed-login message', async () => {
    const gateway = authGateway({
      signInWithPassword: vi.fn(async () => ({ data: { session: null }, error: { message: 'provider secret' } })),
    });
    await expect(service(applicant, gateway).value.signIn('member@example.test', 'wrong'))
      .rejects.toEqual(new SafeAuthError('Email or password is incorrect. Please try again.'));
  });

  it.each([
    ['PRESIDENT', '/admin'],
    ['TREASURER', '/admin'],
    ['SYSTEM_ADMINISTRATOR', '/admin'],
  ])('routes canonical committee role %s to the admin placeholder', async (role, destination) => {
    const state = await service({ ...applicant, role }).value.current();
    expect(destinationForState(state)).toBe(destination);
  });

  it('fails closed for unknown roles and non-ACTIVE users', async () => {
    expect((await service({ ...applicant, role: 'ADMIN' }).value.current()).status).toBe('access-denied');
    expect((await service({ ...applicant, accountStatus: 'SUSPENDED' }).value.current()).status)
      .toBe('access-denied');
    expect(canonicalDestination(null)).toBe('/access-denied');
  });

  it('maps backend 401 to local sign-out and backend 403 to access denied', async () => {
    for (const [error, expected, signsOut] of [
      [new ApiError(401, 'unauthorized', 'expired'), 'unauthenticated', true],
      [new ApiError(403, 'forbidden', 'denied'), 'access-denied', false],
    ] as const) {
      const gateway = authGateway();
      const current = new CanonicalAuthService(gateway, () => ({
        getCurrentUser: vi.fn(async () => { throw error; }),
        setRegistrationName: vi.fn(),
      }));
      expect((await current.current()).status).toBe(expected);
      expect(gateway.signOut).toHaveBeenCalledTimes(signsOut ? 1 : 0);
    }
  });

  it('protects pages from missing sessions and does not flash authenticated content', async () => {
    const gateway = authGateway({ getSession: vi.fn(async () => ({ data: { session: null }, error: null })) });
    const state = await service(applicant, gateway).value.current();
    expect(state.status).toBe('unauthenticated');
    expect(protectedRouteDecision({ status: 'initializing' })).toBe('wait');
    expect(protectedRouteDecision(state)).toBe('login');
  });

  it('returns an API-unavailable state without exposing provider errors', async () => {
    const current = new CanonicalAuthService(authGateway(), () => ({
      getCurrentUser: vi.fn(async () => { throw new Error('postgresql://private:secret@internal'); }),
      setRegistrationName: vi.fn(),
    }));
    expect(await current.current()).toEqual({
      status: 'api-unavailable',
      message: 'We cannot reach MyAIS services right now. Please try again.',
    });
  });
});

describe('registration and recovery', () => {
  it('returns the email-confirmation state and sends only profile metadata, never authorization fields', async () => {
    const gateway = authGateway();
    const names = pendingStore();
    const result = await service(applicant, gateway, names).value.register({
      fullName: 'Nur Aina', email: 'aina@example.test', password: 'secret',
      emailRedirectTo: 'https://app.example.test/auth/callback',
    });
    expect(result).toEqual({ status: 'confirmation-required', email: 'aina@example.test' });
    expect(gateway.signUp).toHaveBeenCalledWith({
      email: 'aina@example.test', password: 'secret',
      options: {
        emailRedirectTo: 'https://app.example.test/auth/callback',
        data: { full_name: 'Nur Aina' },
      },
    });
    expect(JSON.stringify(vi.mocked(gateway.signUp).mock.calls)).not.toMatch(/accountStatus|userId|role/);
    expect(names.save).toHaveBeenCalledWith({ fullName: 'Nur Aina', email: 'aina@example.test' });
  });

  it('synchronizes a pending signup name only after canonical callback resolution', async () => {
    const names = pendingStore({ fullName: 'Nur Aina', email: 'member@example.test', createdAt: Date.now() });
    const fixture = service({ ...applicant, fullName: null }, authGateway({
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    }), names);
    const state = await fixture.value.completeCallback('https://app.example.test/auth/callback?code=confirmed');
    expect(fixture.getCurrentUser).toHaveBeenCalledOnce();
    expect(fixture.setRegistrationName).toHaveBeenCalledWith('Nur Aina');
    expect(state).toMatchObject({ status: 'authenticated', user: { fullName: 'Nur Aina', role: 'APPLICANT' } });
    expect(names.clear).toHaveBeenCalledOnce();
  });

  it('gracefully keeps the canonical user when no pending registration name exists', async () => {
    const names = pendingStore();
    const fixture = service(applicant, authGateway(), names);
    await expect(fixture.value.current()).resolves.toEqual({ status: 'authenticated', user: applicant });
    expect(fixture.setRegistrationName).not.toHaveBeenCalled();
  });

  it('stores only a short-lived name and email record for cross-tab confirmation', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    let now = 1_000;
    const names = createPendingRegistrationNameStore(storage, () => now);
    names.save({ fullName: 'Nur Aina', email: 'aina@example.test' });
    expect(names.read()).toEqual({ fullName: 'Nur Aina', email: 'aina@example.test', createdAt: 1_000 });
    expect([...values.values()].join('')).not.toMatch(/password|token|role|accountStatus|userId/);
    now += 24 * 60 * 60 * 1000 + 1;
    expect(names.read()).toBeNull();
  });

  it('completes a valid confirmation callback through /auth/me and rejects expired callbacks', async () => {
    const valid = service(applicant, authGateway({
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    }));
    expect(destinationForState(await valid.value.completeCallback('https://app.example.test/auth/callback?code=abc')))
      .toBe('/dashboard');
    expect(valid.gateway.exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(valid.getCurrentUser).toHaveBeenCalledOnce();
    await expect(valid.value.completeCallback('https://app.example.test/auth/callback?error_code=otp_expired'))
      .rejects.toBeInstanceOf(SafeAuthError);
  });

  it('always completes forgot-password requests generically', async () => {
    const gateway = authGateway({ resetPasswordForEmail: vi.fn(async () => { throw new Error('unknown account'); }) });
    await expect(service(applicant, gateway).value.requestPasswordReset(
      'member@example.test', 'https://app.example.test/reset-password')).resolves.toBeUndefined();
  });

  it('accepts a valid recovery code, updates the password, and rejects a URL without recovery proof', async () => {
    const fixture = service();
    expect(await fixture.value.preparePasswordRecovery('https://app.example.test/reset-password?code=recovery-code'))
      .toBe(true);
    await fixture.value.updatePassword('new-password');
    expect(fixture.gateway.updateUser).toHaveBeenCalledWith({ password: 'new-password' });
    expect(await fixture.value.preparePasswordRecovery('https://app.example.test/reset-password')).toBe(false);
  });

  it('logs out locally', async () => {
    const fixture = service();
    await fixture.value.logout();
    expect(fixture.gateway.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('typed API client', () => {
  it('invokes the browser fetch implementation without rebinding its receiver', async () => {
    const fetcher = vi.fn(function (this: unknown) {
      expect(this).toBeUndefined();
      return Promise.resolve(new Response(JSON.stringify(applicant), { status: 200 }));
    });
    const client = new ApiClient('https://api.example.test', async () => 'token', fetcher as typeof fetch);
    await expect(client.getCurrentUser()).resolves.toEqual(applicant);
  });

  it('attaches the current Bearer token without exposing it elsewhere', async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer private-access-token');
      return new Response(JSON.stringify(applicant), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const client = new ApiClient('https://api.example.test', async () => 'private-access-token',
      fetcher as typeof fetch);
    await expect(client.getCurrentUser()).resolves.toEqual(applicant);
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/auth/me', expect.any(Object));
  });

  it('sends only fullName to the self-only registration-name endpoint', async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe('PUT');
      expect(JSON.parse(String(init?.body))).toEqual({ fullName: 'Nur Aina' });
      return new Response(JSON.stringify({ fullName: 'Nur Aina', synchronized: true }), { status: 200 });
    });
    const client = new ApiClient('https://api.example.test', async () => 'private-access-token',
      fetcher as typeof fetch);
    await expect(client.setRegistrationName('Nur Aina')).resolves.toEqual({
      fullName: 'Nur Aina', synchronized: true,
    });
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/auth/me/name', expect.any(Object));
  });

  it('contains no web runtime reference to the service-role credential', () => {
    const configSource = readFileSync(new URL('../lib/config.ts', import.meta.url), 'utf8');
    const supabaseSource = readFileSync(new URL('../lib/supabase.ts', import.meta.url), 'utf8');
    expect(`${configSource}\n${supabaseSource}`).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
