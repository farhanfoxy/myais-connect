import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { EligibilityService } from './eligibility.service.js';

@Controller('registration/eligibility')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard)
export class EligibilityController {
  constructor(private readonly eligibility: EligibilityService) {}

  @Post()
  evaluate(@CurrentUser() user: CanonicalPrincipal, @Body() input: unknown) {
    return this.eligibility.evaluateOwn(user.id, input);
  }
}
