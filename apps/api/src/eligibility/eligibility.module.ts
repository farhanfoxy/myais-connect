import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { EligibilityController } from './eligibility.controller.js';
import { EligibilityService } from './eligibility.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EligibilityController],
  providers: [EligibilityService],
  exports: [EligibilityService],
})
export class EligibilityModule {}
