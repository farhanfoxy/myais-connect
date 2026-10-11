import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@myais/database';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { EventsService } from './events.service.js';

export const eventManagerRoles = [
  UserRole.PRESIDENT,
  UserRole.DEPUTY_PRESIDENT,
  UserRole.SECRETARY,
  UserRole.ASSISTANT_SECRETARY,
  UserRole.SYSTEM_ADMINISTRATOR,
] as const;

@Controller('events')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@Query() query: unknown) { return this.events.memberList(query); }

  @Get(':id')
  detail(@Param('id') id: string) { return this.events.memberDetail(id); }
}

@Controller('admin/events')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard, RolesGuard)
@Roles(...eventManagerRoles)
export class AdminEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@Query() query: unknown) { return this.events.adminList(query); }

  @Get(':id')
  detail(@Param('id') id: string) { return this.events.adminDetail(id); }

  @Post()
  create(@CurrentUser() actor: CanonicalPrincipal, @Body() input: unknown) { return this.events.create(actor, input); }

  @Put(':id')
  update(@CurrentUser() actor: CanonicalPrincipal, @Param('id') id: string, @Body() input: unknown) {
    return this.events.update(actor, id, input);
  }

  @Post(':id/publish')
  publish(@CurrentUser() actor: CanonicalPrincipal, @Param('id') id: string) { return this.events.publish(actor, id); }

  @Post(':id/cancel')
  cancel(@CurrentUser() actor: CanonicalPrincipal, @Param('id') id: string, @Body() input: unknown) {
    return this.events.cancel(actor, id, input);
  }
}
