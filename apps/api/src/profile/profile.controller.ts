import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { ProfileService } from './profile.service.js';

@Controller('profile')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard)
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  getOwn(@CurrentUser() user: CanonicalPrincipal) {
    return this.profiles.getOwn(user.id);
  }

  @Put()
  upsertOwn(@CurrentUser() user: CanonicalPrincipal, @Body() input: unknown) {
    return this.profiles.upsertOwn(user.id, input);
  }
}
