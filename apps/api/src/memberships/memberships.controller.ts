import { Controller, Get, StreamableFile, UseGuards } from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { MembershipsService } from './memberships.service.js';

@Controller('memberships')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard)
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get('current')
  current(@CurrentUser() user: CanonicalPrincipal) {
    return this.memberships.currentOwn(user.id);
  }

  @Get('current/card')
  async card(@CurrentUser() user: CanonicalPrincipal) {
    const card = await this.memberships.downloadOwnCard(user.id);
    return new StreamableFile(card.data, { type: 'application/pdf',
      disposition: `attachment; filename="${card.filename}"`, length: card.data.byteLength });
  }
}
