import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@myais/database';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { AnnouncementsService } from './announcements.service.js';

export const announcementManagerRoles = [UserRole.PRESIDENT, UserRole.DEPUTY_PRESIDENT, UserRole.SECRETARY,
  UserRole.ASSISTANT_SECRETARY, UserRole.SYSTEM_ADMINISTRATOR] as const;

@Controller('announcements')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard)
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}
  @Get() list(@CurrentUser() user: CanonicalPrincipal) { return this.announcements.memberList(user); }
  @Get(':id') detail(@CurrentUser() user: CanonicalPrincipal, @Param('id') id: string) {
    return this.announcements.memberDetail(user, id);
  }
}

@Controller('admin/announcements')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard, RolesGuard)
@Roles(...announcementManagerRoles)
export class AdminAnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}
  @Get() list(@Query() query: unknown) { return this.announcements.adminList(query); }
  @Get(':id') detail(@Param('id') id: string) { return this.announcements.adminDetail(id); }
  @Post() create(@CurrentUser() actor: CanonicalPrincipal, @Body() body: unknown) {
    return this.announcements.create(actor, body);
  }
  @Put(':id') update(@CurrentUser() actor: CanonicalPrincipal, @Param('id') id: string, @Body() body: unknown) {
    return this.announcements.update(actor, id, body);
  }
  @Post(':id/publish') publish(@CurrentUser() actor: CanonicalPrincipal, @Param('id') id: string) {
    return this.announcements.publish(actor, id);
  }
  @Post(':id/archive') archive(@CurrentUser() actor: CanonicalPrincipal, @Param('id') id: string) {
    return this.announcements.archive(actor, id);
  }
}
