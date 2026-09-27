import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@myais/database';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { ReviewerPaymentsService } from './reviewer-payments.service.js';

const paymentVerifierRoles = [UserRole.TREASURER, UserRole.SYSTEM_ADMINISTRATOR];

@Controller('reviewer/payments')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard, RolesGuard)
@Roles(...paymentVerifierRoles)
export class ReviewerPaymentsController {
  constructor(private readonly payments: ReviewerPaymentsService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.payments.list(query);
  }

  @Get(':id/receipt/download')
  downloadReceipt(@Param('id') id: string) {
    return this.payments.downloadReceipt(id);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.payments.detail(id);
  }

  @Post(':id/verify')
  verify(@CurrentUser() verifier: CanonicalPrincipal, @Param('id') id: string, @Body() input: unknown) {
    return this.payments.verify(verifier, id, input);
  }

  @Post(':id/reject')
  reject(@CurrentUser() verifier: CanonicalPrincipal, @Param('id') id: string, @Body() input: unknown) {
    return this.payments.reject(verifier, id, input);
  }
}
