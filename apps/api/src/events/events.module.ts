import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { AdminEventsController, EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EventsController, AdminEventsController],
  providers: [EventsService],
})
export class EventsModule {}
