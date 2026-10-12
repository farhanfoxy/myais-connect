import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { AuditLogsController } from './audit-logs.controller.js';
import { AuditLogsService } from './audit-logs.service.js';

@Module({ imports: [PrismaModule, AuthModule], controllers: [AuditLogsController], providers: [AuditLogsService] })
export class AuditLogsModule {}
