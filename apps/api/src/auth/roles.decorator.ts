import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@myais/database';

export const ROLES_KEY = 'canonical_roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
