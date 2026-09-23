import { Controller, Get, UseGuards } from '@nestjs/common';
import { ActiveAccountGuard } from './active-account.guard.js';
import type { CanonicalPrincipal } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';
import { SupabaseJwtGuard } from './supabase-jwt.guard.js';

@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(SupabaseJwtGuard, ActiveAccountGuard)
  me(@CurrentUser() user: CanonicalPrincipal) {
    return { id: user.id, email: user.email, fullName: user.fullName,
      role: user.role, accountStatus: user.accountStatus, photoUrl: user.photoUrl };
  }
}
