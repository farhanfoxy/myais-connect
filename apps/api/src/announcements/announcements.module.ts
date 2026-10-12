import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { AdminAnnouncementsController, AnnouncementsController } from './announcements.controller.js';
import { AnnouncementsService } from './announcements.service.js';

@Module({ imports: [PrismaModule, AuthModule], controllers: [AnnouncementsController, AdminAnnouncementsController],
  providers: [AnnouncementsService] })
export class AnnouncementsModule {}
