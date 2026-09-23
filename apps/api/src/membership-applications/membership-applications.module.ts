import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { EligibilityModule } from '../eligibility/eligibility.module.js';
import { MembershipApplicationsController } from './membership-applications.controller.js';
import { MembershipApplicationsService } from './membership-applications.service.js';

@Module({
  imports: [PrismaModule, AuthModule, EligibilityModule],
  controllers: [MembershipApplicationsController],
  providers: [MembershipApplicationsService],
})
export class MembershipApplicationsModule {}
