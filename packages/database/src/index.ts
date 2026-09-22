import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export { PrismaClient, Prisma, UserAccountStatus, UserRole } from '../generated/prisma/client.js';

// Each backend owns one client and disconnects it during shutdown.
export function createPrismaClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
    query_timeout: 6000,
    max: 10,
  });
  return new PrismaClient({ adapter, log: [], errorFormat: 'minimal' });
}
