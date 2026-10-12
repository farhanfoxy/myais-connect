import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({ imports: [PrismaModule, AuthModule], controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
