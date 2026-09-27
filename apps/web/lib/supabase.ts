import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { validateBrowserEnvironment, type BrowserEnvironment } from './config';

let browserClient: SupabaseClient | undefined;

export function createSupabaseBrowserClient(environment: BrowserEnvironment): SupabaseClient {
  return createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export function getSupabaseBrowserClient(): SupabaseClient {
  browserClient ??= createSupabaseBrowserClient(validateBrowserEnvironment());
  return browserClient;
}
