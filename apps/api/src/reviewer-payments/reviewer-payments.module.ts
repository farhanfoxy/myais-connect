import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { ReviewerPaymentsController } from './reviewer-payments.controller.js';
import { ReviewerPaymentsService } from './reviewer-payments.service.js';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [ReviewerPaymentsController],
  providers: [ReviewerPaymentsService],
})
export class ReviewerPaymentsModule {}
