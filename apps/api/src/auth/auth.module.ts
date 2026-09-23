import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module.js';
import { loadEnvironment } from '../config/environment.js';
import { ActiveAccountGuard } from './active-account.guard.js';
import { AuthController } from './auth.controller.js';
import { CanonicalUserService } from './canonical-user.service.js';
import { RolesGuard } from './roles.guard.js';
import { SupabaseJwtGuard } from './supabase-jwt.guard.js';
import { SupabaseJwtVerifier } from './supabase-jwt.verifier.js';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    { provide: SupabaseJwtVerifier, useFactory: () => new SupabaseJwtVerifier(loadEnvironment()) },
    CanonicalUserService, SupabaseJwtGuard, ActiveAccountGuard, RolesGuard,
  ],
  exports: [SupabaseJwtGuard, ActiveAccountGuard, RolesGuard, CanonicalUserService],
})
export class AuthModule {}
