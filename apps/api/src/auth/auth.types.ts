import type { Prisma } from '@myais/database';

export const principalSelect = {
  id: true,
  supabaseAuthUserId: true,
  email: true,
  fullName: true,
  photoUrl: true,
  profilePhotoObjectKey: true,
  role: true,
  accountStatus: true,
} as const;

export type CanonicalPrincipal = Prisma.UserGetPayload<{ select: typeof principalSelect }>;

export interface VerifiedIdentity {
  supabaseAuthUserId: string;
  email: string | null;
}

export interface AuthenticatedRequest {
  headers: { authorization?: string | string[] };
  principal?: CanonicalPrincipal;
}
