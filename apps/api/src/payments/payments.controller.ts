import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard.js';
import type { CanonicalPrincipal } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
@UseGuards(SupabaseJwtGuard, ActiveAccountGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('current')
  current(@CurrentUser() user: CanonicalPrincipal) {
    return this.payments.currentOwn(user.id);
  }

  @Post('current/receipt-upload')
  initiateReceiptUpload(@CurrentUser() user: CanonicalPrincipal, @Body() input: unknown) {
    return this.payments.initiateReceiptUpload(user.id, input);
  }

  @Post('current/receipt-upload/finalize')
  finalizeReceiptAndSubmit(@CurrentUser() user: CanonicalPrincipal, @Body() input: unknown) {
    return this.payments.finalizeReceiptAndSubmit(user.id, input);
  }
}
