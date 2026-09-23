import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

export class EnvironmentError extends Error {}

export interface ApiEnvironment {
  databaseUrl: string;
  supabaseUrl: string;
  supabaseJwtAudience: string;
  supabaseJwtIssuer: string;
  supabaseJwksUrl: string;
  port: number;
  host: string;
}

export function validateEnvironment(env: NodeJS.ProcessEnv): ApiEnvironment {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl?.trim()) throw new EnvironmentError('DATABASE_URL is required');
  try {
    const url = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) throw new Error();
  } catch {
    throw new EnvironmentError('DATABASE_URL must be a valid PostgreSQL connection URL');
  }
  const supabaseUrl = env.SUPABASE_URL;
  if (!supabaseUrl?.trim()) throw new EnvironmentError('SUPABASE_URL is required');
  let parsedSupabaseUrl: URL;
  try {
    parsedSupabaseUrl = new URL(supabaseUrl);
    const localHttp = parsedSupabaseUrl.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(parsedSupabaseUrl.hostname);
    if ((!localHttp && parsedSupabaseUrl.protocol !== 'https:') || !parsedSupabaseUrl.hostname ||
        parsedSupabaseUrl.username || parsedSupabaseUrl.password || parsedSupabaseUrl.pathname !== '/' ||
        parsedSupabaseUrl.search || parsedSupabaseUrl.hash) throw new Error();
  } catch {
    throw new EnvironmentError('SUPABASE_URL must be a valid Supabase origin URL');
  }
  const supabaseJwtAudience = env.SUPABASE_JWT_AUDIENCE ?? 'authenticated';
  if (!supabaseJwtAudience.trim() || supabaseJwtAudience !== supabaseJwtAudience.trim() || /[\r\n]/.test(supabaseJwtAudience))
    throw new EnvironmentError('SUPABASE_JWT_AUDIENCE must be a non-empty value');
  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new EnvironmentError('PORT must be an integer between 1 and 65535');
  const authBaseUrl = `${parsedSupabaseUrl.origin}/auth/v1`;
  return { databaseUrl, supabaseUrl: parsedSupabaseUrl.origin, supabaseJwtAudience,
    supabaseJwtIssuer: authBaseUrl, supabaseJwksUrl: `${authBaseUrl}/.well-known/jwks.json`,
    port, host: env.HOST ?? '127.0.0.1' };
}

export function loadEnvironment(): ApiEnvironment {
  // Resolve apps/api/.env from either src/config or dist/config; process env wins.
  const loaded = config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), override: false, quiet: true });
  if (loaded.error && (loaded.error as NodeJS.ErrnoException).code !== 'ENOENT')
    throw new EnvironmentError('API environment file could not be loaded');
  return validateEnvironment(process.env);
}
