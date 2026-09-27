export interface BrowserEnvironment {
  supabaseUrl: string;
  supabasePublishableKey: string;
  apiUrl: string;
}

export class BrowserEnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrowserEnvironmentError';
  }
}

const publicEnvironment = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
};

export function validateBrowserEnvironment(
  input: Record<string, string | undefined> = publicEnvironment,
): BrowserEnvironment {
  const supabaseUrl = validOrigin(input.supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL');
  const apiUrl = validOrigin(input.apiUrl, 'NEXT_PUBLIC_API_URL');
  const supabasePublishableKey = input.supabasePublishableKey;
  if (!supabasePublishableKey?.trim() || supabasePublishableKey !== supabasePublishableKey.trim() ||
      /[\r\n]/.test(supabasePublishableKey)) {
    throw new BrowserEnvironmentError('Web authentication configuration is unavailable');
  }
  return { supabaseUrl, supabasePublishableKey, apiUrl };
}

function validOrigin(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new BrowserEnvironmentError(`${name} is unavailable`);
  try {
    const url = new URL(value);
    const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((!localHttp && url.protocol !== 'https:') || url.username || url.password || url.pathname !== '/' ||
        url.search || url.hash) throw new Error();
    return url.origin;
  } catch {
    throw new BrowserEnvironmentError(`${name} is unavailable`);
  }
}
