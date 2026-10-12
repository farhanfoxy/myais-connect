import { Controller, Get, Param, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { UserRole } from '@myais/database';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { ReportsService } from './reports.service.js';

@Controller('admin/reports')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard, RolesGuard)
@Roles(UserRole.SYSTEM_ADMINISTRATOR, UserRole.PRESIDENT, UserRole.SECRETARY, UserRole.ASSISTANT_SECRETARY, UserRole.TREASURER)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Get(':type')
  async export(@CurrentUser() actor: CanonicalPrincipal, @Param('type') type: string, @Query() query: unknown) {
    const result = await this.reports.export(actor, type, query);
    return new StreamableFile(result.data, { type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`, length: result.data.byteLength });
  }
}
