import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { MembershipTypesController } from './membership-types.controller.js';
import { MembershipTypesService } from './membership-types.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MembershipTypesController],
  providers: [MembershipTypesService],
})
export class MembershipTypesModule {}
