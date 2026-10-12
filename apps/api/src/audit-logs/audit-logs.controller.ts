import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@myais/database';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { AuditLogsService } from './audit-logs.service.js';

export const auditViewerRoles = [UserRole.SYSTEM_ADMINISTRATOR, UserRole.PRESIDENT] as const;

@Controller('admin/audit')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard, RolesGuard)
@Roles(...auditViewerRoles)
export class AuditLogsController {
  constructor(private readonly audit: AuditLogsService) {}
  @Get()
  list(@Query() query: unknown) { return this.audit.list(query); }
}
