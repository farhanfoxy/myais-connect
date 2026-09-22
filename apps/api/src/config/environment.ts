import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

export class EnvironmentError extends Error {}

export interface ApiEnvironment {
  databaseUrl: string;
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
  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new EnvironmentError('PORT must be an integer between 1 and 65535');
  return { databaseUrl, port, host: env.HOST ?? '127.0.0.1' };
}

export function loadEnvironment(): ApiEnvironment {
  // Resolve apps/api/.env from either src/config or dist/config; process env wins.
  const loaded = config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), override: false, quiet: true });
  if (loaded.error && (loaded.error as NodeJS.ErrnoException).code !== 'ENOENT')
    throw new EnvironmentError('API environment file could not be loaded');
  return validateEnvironment(process.env);
}
