import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get() list(@CurrentUser() user: CanonicalPrincipal, @Query() query: unknown) { return this.notifications.list(user.id, query); }
  @Get('unread-count') unread(@CurrentUser() user: CanonicalPrincipal) { return this.notifications.unreadCount(user.id); }
  @Post('read-all') readAll(@CurrentUser() user: CanonicalPrincipal) { return this.notifications.readAll(user.id); }
  @Post(':id/read') read(@CurrentUser() user: CanonicalPrincipal, @Param('id') id: string) { return this.notifications.read(user.id, id); }
}
