import { Controller, Get, Header, Inject, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async getHealth() {
    try {
      await this.prisma.checkConnection();
      return { api: 'up', database: 'up', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({ api: 'up', database: 'down', timestamp: new Date().toISOString() });
    }
  }
}
