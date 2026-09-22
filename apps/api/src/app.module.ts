import { Module } from '@nestjs/common';
import { PrismaModule } from './database/prisma.module.js';
import { HealthController } from './health/health.controller.js';

@Module({ imports: [PrismaModule], controllers: [HealthController] })
export class AppModule {}
