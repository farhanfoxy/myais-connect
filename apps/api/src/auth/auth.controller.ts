import { Body, Controller, Get, Inject, Put, UseGuards } from '@nestjs/common';
import { PRIVATE_STORAGE, type PrivateStorage } from '../storage/private-storage.js';
import { ActiveAccountGuard } from './active-account.guard.js';
import type { CanonicalPrincipal } from './auth.types.js';
import { CanonicalUserService } from './canonical-user.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { SupabaseJwtGuard } from './supabase-jwt.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly users: CanonicalUserService,
    @Inject(PRIVATE_STORAGE) private readonly storage: PrivateStorage) {}

  @Get('me')
  @UseGuards(SupabaseJwtGuard, ActiveAccountGuard)
  async me(@CurrentUser() user: CanonicalPrincipal) {
    let photoUrl = user.photoUrl;
    if (user.profilePhotoObjectKey) {
      try { photoUrl = (await this.storage.createDownloadTarget(user.profilePhotoObjectKey, 5 * 60)).downloadUrl; }
      catch { /* Preserve the legacy fallback when private storage is temporarily unavailable. */ }
    }
    return { id: user.id, email: user.email, fullName: user.fullName,
      role: user.role, accountStatus: user.accountStatus, photoUrl };
  }

  @Put('me/name')
  @UseGuards(SupabaseJwtGuard, ActiveAccountGuard)
  updateOwnRegistrationName(@CurrentUser() user: CanonicalPrincipal, @Body() input: unknown) {
    return this.users.updateOwnRegistrationName(user.id, input);
  }
}
