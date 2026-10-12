import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { AdminMembersController } from './admin-members.controller.js';
import { AdminMembersService } from './admin-members.service.js';

@Module({ imports: [PrismaModule, AuthModule], controllers: [AdminMembersController], providers: [AdminMembersService] })
export class AdminMembersModule {}
