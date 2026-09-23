import { Module } from '@nestjs/common';
import { PrismaModule } from './database/prisma.module.js';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './auth/auth.module.js';

@Module({ imports: [PrismaModule, AuthModule], controllers: [HealthController] })
export class AppModule {}
