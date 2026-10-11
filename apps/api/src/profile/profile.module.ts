import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
