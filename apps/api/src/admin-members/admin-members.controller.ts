import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@myais/database';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { AdminMembersService } from './admin-members.service.js';

export const memberDirectoryRoles = [UserRole.PRESIDENT, UserRole.DEPUTY_PRESIDENT, UserRole.SECRETARY,
  UserRole.ASSISTANT_SECRETARY, UserRole.SYSTEM_ADMINISTRATOR] as const;

@Controller('admin/members')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard, RolesGuard)
@Roles(...memberDirectoryRoles)
export class AdminMembersController {
  constructor(private readonly members: AdminMembersService) {}
  @Get()
  list(@Query() query: unknown) { return this.members.list(query); }
  @Get(':id')
  detail(@Param('id') id: string) { return this.members.detail(id); }
}
