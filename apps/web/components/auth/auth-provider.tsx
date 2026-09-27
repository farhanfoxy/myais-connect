'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createApiClient } from '@/lib/api-client';
import {
  CanonicalAuthService,
  type AuthGateway,
  type CurrentAuthState,
  type RegistrationResult,
} from '@/lib/auth-service';
import { getSupabaseBrowserClient } from '@/lib/supabase';

interface AuthContextValue {
  state: CurrentAuthState;
  refresh(): Promise<CurrentAuthState>;
  signIn(email: string, password: string): Promise<CurrentAuthState>;
  register(input: { fullName: string; email: string; password: string }): Promise<RegistrationResult>;
  completeCallback(url: string): Promise<CurrentAuthState>;
  requestPasswordReset(email: string): Promise<void>;
  preparePasswordRecovery(url: string): Promise<boolean>;
  updatePassword(password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function createService(): CanonicalAuthService {
  const supabase = getSupabaseBrowserClient();
  return new CanonicalAuthService(
    supabase.auth as unknown as AuthGateway,
    token => createApiClient(async () => token),
  );
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [state, setState] = useState<CurrentAuthState>({ status: 'initializing' });

  const run = useCallback(async (action: (service: CanonicalAuthService) => Promise<CurrentAuthState>) => {
    try {
      const next = await action(createService());
      setState(next);
      return next;
    } catch (error) {
      if (error instanceof Error && error.name === 'BrowserEnvironmentError') {
        const next: CurrentAuthState = {
          status: 'api-unavailable',
          message: 'MyAIS web configuration is unavailable.',
        };
        setState(next);
        return next;
      }
      throw error;
    }
  }, []);

  const refresh = useCallback(() => run(service => service.current()), [run]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void refresh();
    });
    let unsubscribe: (() => void) | undefined;
    try {
      const supabase = getSupabaseBrowserClient();
      const subscription = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
        if (!active) return;
        if (event === 'SIGNED_OUT' || !session) setState({ status: 'unauthenticated' });
        else if (event === 'TOKEN_REFRESHED') void refresh();
      });
      unsubscribe = () => subscription.data.subscription.unsubscribe();
    } catch {
      // refresh provides the safe configuration error state.
    }
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [refresh]);

  const value = useMemo<AuthContextValue>(() => ({
    state,
    refresh,
    signIn: (email, password) => run(service => service.signIn(email, password)),
    register: async input => {
      const service = createService();
      const result = await service.register({
        ...input,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      });
      if (result.status !== 'confirmation-required') setState(result);
      return result;
    },
    completeCallback: url => run(service => service.completeCallback(url)),
    requestPasswordReset: async email => {
      try {
        await createService().requestPasswordReset(email, `${window.location.origin}/reset-password`);
      } catch {
        // Preserve the generic response even when the auth provider is unavailable.
      }
    },
    preparePasswordRecovery: async url => {
      try {
        return await createService().preparePasswordRecovery(url);
      } catch {
        return false;
      }
    },
    updatePassword: password => createService().updatePassword(password),
    logout: async () => {
      await createService().logout();
      setState({ status: 'unauthenticated' });
    },
  }), [refresh, run, state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
