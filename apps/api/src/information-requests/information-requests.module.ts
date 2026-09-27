import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { InformationRequestsController } from './information-requests.controller.js';
import { InformationRequestsService } from './information-requests.service.js';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [InformationRequestsController],
  providers: [InformationRequestsService],
})
export class InformationRequestsModule {}
