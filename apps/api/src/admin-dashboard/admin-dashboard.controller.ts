import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@myais/database';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { AdminDashboardService } from './admin-dashboard.service.js';

export const dashboardRoles = [
  UserRole.PRESIDENT,
  UserRole.DEPUTY_PRESIDENT,
  UserRole.SECRETARY,
  UserRole.ASSISTANT_SECRETARY,
  UserRole.TREASURER,
  UserRole.COMMITTEE_MEMBER,
  UserRole.SYSTEM_ADMINISTRATOR,
] as const;

@Controller('admin/dashboard')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard, RolesGuard)
@Roles(...dashboardRoles)
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get()
  get(@CurrentUser() viewer: CanonicalPrincipal) {
    return this.dashboard.get(viewer);
  }
}
