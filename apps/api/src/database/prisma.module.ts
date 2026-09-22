import { Module } from '@nestjs/common';
import { createPrismaClient } from '@myais/database';
import { loadEnvironment } from '../config/environment.js';
import { PrismaService, PRISMA_CLIENT } from './prisma.service.js';

@Module({
  providers: [
    { provide: PRISMA_CLIENT, useFactory: () => createPrismaClient(loadEnvironment().databaseUrl) },
    PrismaService,
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
