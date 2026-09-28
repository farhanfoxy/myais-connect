import { createApiClient } from '@/lib/api-client';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export function createMemberApiClient() {
  return createApiClient(async () => {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    return data.session?.access_token ?? null;
  });
}
