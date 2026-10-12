import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@myais/database';
import { auditLogQuerySchema } from '@myais/validation';
import { PrismaService } from '../database/prisma.service.js';

function nextDay(value: string): string {
  const date = new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)) + 1));
  return date.toISOString().slice(0, 10);
}

function label(action: string): string {
  return action.toLowerCase().split('_').map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ');
}

@Injectable()
export class AuditLogsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(input: unknown) {
    const parsed = auditLogQuerySchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid audit query');
    const { actor, action, entity, from, to, page, pageSize } = parsed.data;
    const where: Prisma.AuditLogWhereInput = {};
    if (actor) where.OR = [{ actorName: { contains: actor, mode: 'insensitive' } },
      { actorUser: { email: { contains: actor, mode: 'insensitive' } } }];
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (entity) where.entityType = { contains: entity, mode: 'insensitive' };
    if (from || to) where.createdAt = { ...(from ? { gte: new Date(`${from}T00:00:00.000+08:00`) } : {}),
      ...(to ? { lt: new Date(`${nextDay(to)}T00:00:00.000+08:00`) } : {}) };
    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.auditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize, take: pageSize, select: { id: true, actorName: true, action: true,
          entityType: true, description: true, createdAt: true,
          actorUser: { select: { fullName: true, email: true } } } }),
      this.prisma.client.auditLog.count({ where }),
    ]);
    return { items: items.map(item => ({ id: item.id, actorName: item.actorName ?? item.actorUser?.fullName ??
      item.actorUser?.email ?? 'System', action: item.action, actionLabel: label(item.action), entityType: item.entityType,
      description: item.description, createdAt: item.createdAt.toISOString() })),
    page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }
}
