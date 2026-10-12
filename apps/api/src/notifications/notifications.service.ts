import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { notificationQuerySchema, uuidPathSchema } from '@myais/validation';
import { PrismaService } from '../database/prisma.service.js';

const select = { id: true, userId: true, eventType: true, type: true, title: true, message: true, actionUrl: true,
  isRead: true, readAt: true, createdAt: true } as const;

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(userId: string, input: unknown) { const parsed = notificationQuerySchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid notification query'); const { page, pageSize, unreadOnly } = parsed.data;
    const where = { userId, ...(unreadOnly ? { isRead: false } : {}) };
    const [records, total] = await this.prisma.client.$transaction([this.prisma.client.notification.findMany({ where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize, select }),
      this.prisma.client.notification.count({ where })]);
    return { items: records.map(item => ({ ...item, eventType: item.eventType ?? item.type ?? 'SYSTEM',
      isRead: item.isRead === true, readAt: item.readAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString() })),
      page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }
  async unreadCount(userId: string) { return { count: await this.prisma.client.notification.count({ where: { userId, isRead: false } }) }; }
  async readAll(userId: string) { const now = new Date(); const result = await this.prisma.client.notification.updateMany({
    where: { userId, isRead: false }, data: { isRead: true, readAt: now } }); return { updated: result.count, readAt: now.toISOString() }; }
  async read(userId: string, input: string) { const parsed = uuidPathSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid notification ID'); const current = await this.prisma.client.notification.findFirst({
      where: { id: parsed.data, userId }, select }); if (!current) throw new NotFoundException('Notification not found');
    if (current.isRead) return { ...current, eventType: current.eventType ?? current.type ?? 'SYSTEM', isRead: true,
      readAt: current.readAt?.toISOString() ?? null, createdAt: current.createdAt.toISOString() };
    const item = await this.prisma.client.notification.update({ where: { id: current.id }, data: { isRead: true, readAt: new Date() }, select });
    return { ...item, eventType: item.eventType ?? item.type ?? 'SYSTEM', isRead: true,
      readAt: item.readAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString() };
  }
}
