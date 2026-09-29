import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { MembershipTypesController } from './membership-types.controller.js';
import { MembershipTypesService } from './membership-types.service.js';
import { ReviewerMembershipTypesController } from './reviewer-membership-types.controller.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MembershipTypesController, ReviewerMembershipTypesController],
  providers: [MembershipTypesService],
})
export class MembershipTypesModule {}
