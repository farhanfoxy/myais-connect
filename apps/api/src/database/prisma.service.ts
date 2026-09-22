import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@myais/database';

export const PRISMA_CLIENT = Symbol('PRISMA_CLIENT');

@Injectable()
export class PrismaService implements OnModuleDestroy {
  constructor(@Inject(PRISMA_CLIENT) readonly client: PrismaClient) {}

  async checkConnection(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
