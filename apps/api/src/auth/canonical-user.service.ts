import { ForbiddenException, Injectable, Inject, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { principalSelect, type CanonicalPrincipal, type VerifiedIdentity } from './auth.types.js';

function isConcurrentConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    (error.code === 'P2002' || error.code === 'P2034');
}

@Injectable()
export class CanonicalUserService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolve(identity: VerifiedIdentity): Promise<CanonicalPrincipal> {
    const client = this.prisma.client;
    const linked = await client.user.findUnique({
      where: { supabaseAuthUserId: identity.supabaseAuthUserId }, select: principalSelect,
    });
    if (linked) return linked;

    const email = identity.email?.trim().toLowerCase();
    if (!email) throw new ForbiddenException('Account access denied');

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await client.$transaction(async transaction => {
          // Serialize linking and provisioning for a normalized email across API processes.
          await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 0))::text AS "lock"`;
          const alreadyLinked = await transaction.user.findUnique({
            where: { supabaseAuthUserId: identity.supabaseAuthUserId }, select: principalSelect,
          });
          if (alreadyLinked) return alreadyLinked;

          const matches = await transaction.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "User" WHERE lower(btrim("email")) = ${email} LIMIT 2
          `;
          if (matches.length > 1) throw new ForbiddenException('Account access denied');
          if (matches.length === 1) {
            const candidateId = matches[0]?.id;
            if (!candidateId) throw new ServiceUnavailableException('Account lookup unavailable');
            const candidate = await transaction.user.findUnique({
              where: { id: candidateId }, select: principalSelect,
            });
            if (!candidate || candidate.accountStatus !== 'ACTIVE' || candidate.supabaseAuthUserId !== null)
              throw new ForbiddenException('Account access denied');
            const updated = await transaction.user.updateMany({
              where: { id: candidateId, accountStatus: 'ACTIVE', supabaseAuthUserId: null },
              data: { supabaseAuthUserId: identity.supabaseAuthUserId },
            });
            if (updated.count !== 1) throw new ServiceUnavailableException('Account lookup unavailable');
            const newlyLinked = await transaction.user.findUnique({
              where: { supabaseAuthUserId: identity.supabaseAuthUserId }, select: principalSelect,
            });
            if (!newlyLinked) throw new ServiceUnavailableException('Account lookup unavailable');
            return newlyLinked;
          }
          return transaction.user.create({
            data: { supabaseAuthUserId: identity.supabaseAuthUserId, email,
              role: 'APPLICANT', accountStatus: 'ACTIVE' },
            select: principalSelect,
          });
        }, { isolationLevel: 'Serializable' });
      } catch (error) {
        if (error instanceof ForbiddenException || error instanceof ServiceUnavailableException) throw error;
        if (isConcurrentConflict(error)) continue;
        throw new ServiceUnavailableException('Account lookup unavailable');
      }
    }
    // A concurrent request may have completed the same identity's link/create.
    try {
      const winner = await client.user.findUnique({
        where: { supabaseAuthUserId: identity.supabaseAuthUserId }, select: principalSelect,
      });
      if (winner) return winner;
    } catch {
      throw new ServiceUnavailableException('Account lookup unavailable');
    }
    throw new ServiceUnavailableException('Account lookup unavailable');
  }
}
