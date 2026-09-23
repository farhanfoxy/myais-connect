import type { UserAccountStatus } from '@myais/database';

export function canAccessProtectedApi(accountStatus: UserAccountStatus | null | undefined): boolean {
  return accountStatus === 'ACTIVE';
}
