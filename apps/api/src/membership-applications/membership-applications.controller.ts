import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { MembershipApplicationsService } from './membership-applications.service.js';

@Controller('applications')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard)
export class MembershipApplicationsController {
  constructor(private readonly applications: MembershipApplicationsService) {}

  @Post('draft')
  createDraft(@CurrentUser() user: CanonicalPrincipal, @Body() input: unknown) {
    return this.applications.createDraft(user.id, input);
  }

  @Get()
  listOwn(@CurrentUser() user: CanonicalPrincipal) {
    return this.applications.listOwn(user.id);
  }

  @Get('current')
  currentOwn(@CurrentUser() user: CanonicalPrincipal) {
    return this.applications.currentOwn(user.id);
  }

  @Post(':id/submit')
  submitOwn(@CurrentUser() user: CanonicalPrincipal, @Param('id') id: string, @Body() input: unknown) {
    return this.applications.submitOwn(user.id, id, input);
  }

  @Get(':id')
  detailOwn(@CurrentUser() user: CanonicalPrincipal, @Param('id') id: string) {
    return this.applications.detailOwn(user.id, id);
  }
}
