import { Module } from '@nestjs/common';
import { PrismaModule } from './database/prisma.module.js';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { MembershipTypesModule } from './membership-types/membership-types.module.js';
import { ProfileModule } from './profile/profile.module.js';

@Module({
  imports: [PrismaModule, AuthModule, MembershipTypesModule, ProfileModule],
  controllers: [HealthController],
})
export class AppModule {}
