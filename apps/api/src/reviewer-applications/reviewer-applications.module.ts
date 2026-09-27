import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { ReviewerApplicationsController } from './reviewer-applications.controller.js';
import { ReviewerApplicationsService } from './reviewer-applications.service.js';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [ReviewerApplicationsController],
  providers: [ReviewerApplicationsService],
})
export class ReviewerApplicationsModule {}
