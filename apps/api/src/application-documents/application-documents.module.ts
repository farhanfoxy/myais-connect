import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { ApplicationDocumentsController } from './application-documents.controller.js';
import { ApplicationDocumentsService } from './application-documents.service.js';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [ApplicationDocumentsController],
  providers: [ApplicationDocumentsService],
})
export class ApplicationDocumentsModule {}
