import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { AdminEventsController, EventsController } from './events.controller.js';
import { EventRegistrationsService } from './event-registrations.service.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EventsController, AdminEventsController],
  providers: [EventsService, EventRegistrationsService],
})
export class EventsModule {}
