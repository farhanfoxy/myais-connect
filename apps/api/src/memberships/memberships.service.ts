import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PrismaService } from '../database/prisma.service.js';

function dateOnly(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

@Injectable()
export class MembershipsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async currentOwn(userId: string) {
    const membership = await this.prisma.client.membership.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        membershipNumber: true,
        membershipTypeCode: true,
        membershipTypeName: true,
        status: true,
        startDate: true,
        expiryDate: true,
        votingEligible: true,
        activatedAt: true,
        membershipType: { select: { code: true, name: true } },
      },
    });
    if (!membership) return null;
    const { membershipType, ...safeMembership } = membership;
    return {
      ...safeMembership,
      membershipTypeCode: membership.membershipTypeCode ?? membershipType.code,
      membershipTypeName: membership.membershipTypeName ?? membershipType.name,
      startDate: dateOnly(membership.startDate),
      expiryDate: dateOnly(membership.expiryDate),
      activatedAt: membership.activatedAt?.toISOString() ?? null,
    };
  }

  async downloadOwnCard(userId: string) {
    const membership = await this.prisma.client.membership.findFirst({ where: { userId, status: 'ACTIVE' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { membershipNumber: true, membershipTypeName: true,
        startDate: true, expiryDate: true, membershipType: { select: { name: true, active: true } },
        user: { select: { fullName: true, email: true, memberProfileByUser: { select: { fullName: true } } } } } });
    if (!membership || membership.membershipType.active !== true) throw new NotFoundException('Active membership card not available');
    const name = membership.user.memberProfileByUser?.fullName || membership.user.fullName || membership.user.email || 'MyAIS Member';
    const pdf = await PDFDocument.create(); const page = pdf.addPage([720, 450]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const navy = rgb(0.02, 0.12, 0.23); const teal = rgb(0.08, 0.72, 0.72); const mint = rgb(0.66, 0.95, 0.88);
    page.drawRectangle({ x: 0, y: 0, width: 720, height: 450, color: navy });
    page.drawCircle({ x: 690, y: 430, size: 175, color: rgb(0.02, 0.30, 0.40), opacity: 0.6 });
    page.drawCircle({ x: 20, y: 10, size: 135, color: rgb(0.02, 0.45, 0.48), opacity: 0.35 });
    page.drawText('MyAIS', { x: 48, y: 382, size: 30, font: bold, color: teal });
    page.drawText('|  MyAIS Connect', { x: 142, y: 386, size: 19, font: bold, color: rgb(0.93, 0.98, 1) });
    page.drawText(this.pdfText(membership.membershipTypeName || membership.membershipType.name).toUpperCase(),
      { x: 48, y: 300, size: 14, font: bold, color: mint });
    page.drawText(this.pdfText(name), { x: 48, y: 245, size: 28, font: bold, color: rgb(1, 1, 1), maxWidth: 620 });
    page.drawText('MEMBER NUMBER', { x: 48, y: 177, size: 10, font: regular, color: rgb(0.65, 0.78, 0.85) });
    page.drawText(this.pdfText(membership.membershipNumber || 'Not available'), { x: 48, y: 151, size: 17, font: bold, color: rgb(1, 1, 1) });
    page.drawText('VALID FROM', { x: 390, y: 177, size: 10, font: regular, color: rgb(0.65, 0.78, 0.85) });
    page.drawText(dateOnly(membership.startDate) || 'Not specified', { x: 390, y: 151, size: 15, font: bold, color: rgb(1, 1, 1) });
    page.drawText('VALID UNTIL', { x: 535, y: 177, size: 10, font: regular, color: rgb(0.65, 0.78, 0.85) });
    page.drawText(dateOnly(membership.expiryDate) || 'Lifetime', { x: 535, y: 151, size: 15, font: bold, color: rgb(1, 1, 1) });
    page.drawLine({ start: { x: 48, y: 104 }, end: { x: 672, y: 104 }, thickness: 1, color: rgb(0.2, 0.48, 0.56) });
    page.drawText('Association for Information Systems Malaysia Chapter', { x: 48, y: 67, size: 12, font: regular,
      color: rgb(0.72, 0.84, 0.89) });
    const bytes = await pdf.save(); const fileName = this.pdfText(name).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Member';
    return { data: Buffer.from(bytes), filename: `MyAIS-Membership-Card-${fileName}.pdf` };
  }

  private pdfText(value: string): string {
    return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '?');
  }
}
