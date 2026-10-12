import assert from 'node:assert/strict';
import test from 'node:test';
import { UserRole } from '@myais/database';
import { AnnouncementsService } from '../dist/announcements/announcements.service.js';
import { announcementManagerRoles } from '../dist/announcements/announcements.controller.js';
import { NotificationsService } from '../dist/notifications/notifications.service.js';
import { MembershipsService } from '../dist/memberships/memberships.service.js';
import { MembershipsController } from '../dist/memberships/memberships.controller.js';
import { ReportsService } from '../dist/reports/reports.service.js';

const user = { id: '111e4567-e89b-42d3-a456-426614174000', role: UserRole.APPLICANT,
  accountStatus: 'ACTIVE', fullName: 'Formula Member', email: 'member@example.test' };
const announcement = { id: '222e4567-e89b-42d3-a456-426614174000', title: 'Published news', category: 'GENERAL',
  summary: 'Summary', content: 'Body', targetAudience: 'APPLICANTS', status: 'PUBLISHED', publishAt: new Date(), expiryAt: null,
  createdByName: 'Secretary', createdAt: new Date(), updatedAt: new Date() };

test('announcement policy is exact and member reads are published/audience scoped', async () => {
  assert.deepEqual([...announcementManagerRoles], [UserRole.PRESIDENT, UserRole.DEPUTY_PRESIDENT, UserRole.SECRETARY,
    UserRole.ASSISTANT_SECRETARY, UserRole.SYSTEM_ADMINISTRATOR]);
  let where;
  const service = new AnnouncementsService({ client: { announcement: { async findMany(input) { where = input.where; return [announcement]; } } } });
  const result = await service.memberList(user);
  assert.equal(result[0].title, 'Published news');
  assert.equal(where.status, 'PUBLISHED');
  assert.deepEqual(where.targetAudience.in, ['ALL', 'APPLICANTS']);
});

test('authorized announcement lifecycle remains draft-only for edits and audits create/publish/archive', async () => {
  let row; const audits = []; const client = { announcement: {
    async create({ data }) { row = { ...announcement, ...data, id: announcement.id, status: 'DRAFT', publishAt: null,
      expiryAt: null, createdAt: new Date(), updatedAt: new Date() }; return row; },
    async findUnique() { return row; }, async update({ data }) { row = { ...row, ...data, updatedAt: new Date() }; return row; },
  }, user: { async findMany() { return []; } }, notification: { async createMany() { return { count: 0 }; } },
  auditLog: { async create({ data }) { audits.push(data); return data; } }, async $transaction(work) { return work(client); } };
  const service = new AnnouncementsService({ client }); const actor = { ...user, role: UserRole.SECRETARY };
  await service.create(actor, { title: 'Draft', summary: 'Summary', content: 'Body', category: 'GENERAL', targetAudience: 'ALL' });
  await service.update(actor, announcement.id, { title: 'Edited', summary: null, content: 'Body', category: 'GENERAL', targetAudience: 'ALL' });
  assert.equal((await service.publish(actor, announcement.id)).status, 'PUBLISHED');
  assert.equal((await service.archive(actor, announcement.id)).status, 'ARCHIVED');
  assert.deepEqual(audits.map(item => item.action), ['ANNOUNCEMENT_CREATED', 'ANNOUNCEMENT_UPDATED',
    'ANNOUNCEMENT_PUBLISHED', 'ANNOUNCEMENT_ARCHIVED']);
});

test('notifications are isolated to the principal and unread mutations cannot cross users', async () => {
  const calls = []; const record = { id: announcement.id, userId: user.id, eventType: 'ANNOUNCEMENT_PUBLISHED', type: 'ANNOUNCEMENT',
    title: 'News', message: 'Published', actionUrl: '/news/x', isRead: false, readAt: null, createdAt: new Date() };
  const client = { notification: {
    async findMany(input) { calls.push(input.where); return [record]; }, async count(input) { calls.push(input.where); return 1; },
    async findFirst(input) { calls.push(input.where); return input.where.userId === user.id ? record : null; },
    async update({ data }) { return { ...record, ...data }; }, async updateMany(input) { calls.push(input.where); return { count: 1 }; },
  }, async $transaction(items) { return Promise.all(items); } };
  const service = new NotificationsService({ client });
  assert.equal((await service.list(user.id, { unreadOnly: 'true' })).items[0].eventType, 'ANNOUNCEMENT_PUBLISHED');
  assert.equal((await service.unreadCount(user.id)).count, 1);
  await service.read(user.id, announcement.id); await service.readAll(user.id);
  assert(calls.every(where => where.userId === user.id));
  await assert.rejects(service.read('333e4567-e89b-42d3-a456-426614174000', announcement.id), error => error.getStatus() === 404);
});

test('membership card PDF is generated only from an owned active membership', async () => {
  const active = { membershipNumber: 'MYAIS-2026-000001', membershipTypeName: 'Ordinary Member', startDate: new Date('2026-01-01'),
    expiryDate: new Date('2026-12-31'), membershipType: { name: 'Ordinary Member', active: true },
    user: { fullName: 'Member Name', email: 'member@example.test', memberProfileByUser: { fullName: 'Member Name' } } };
  let where; const service = new MembershipsService({ client: { membership: { async findFirst(input) { where = input.where; return active; } } } });
  const card = await service.downloadOwnCard(user.id); assert.deepEqual(where, { userId: user.id, status: 'ACTIVE' });
  assert.equal(card.data.subarray(0, 4).toString(), '%PDF'); assert.match(card.filename, /^MyAIS-Membership-Card-/);
  let requestedUser; const stream = await new MembershipsController({ async downloadOwnCard(userId) { requestedUser = userId; return card; } }).card(user);
  assert.equal(requestedUser, user.id); assert.equal(stream.getHeaders().type, 'application/pdf');
  const missing = new MembershipsService({ client: { membership: { async findFirst() { return null; } } } });
  await assert.rejects(missing.downloadOwnCard(user.id), error => error.getStatus() === 404);
});

test('reports enforce role/category access, server filters, true XLSX and formula-safe CSV', async () => {
  let memberWhere; const client = { user: { async findMany(input) { memberWhere = input.where; return [{ fullName: '=2+2',
    email: 'safe@example.test', phoneNumber: null, role: 'ORDINARY_MEMBER', accountStatus: 'ACTIVE',
    memberProfileByUser: { institution: '@unsafe', occupation: 'Analyst' } }]; } }, auditLog: { async create() { return {}; } } };
  const service = new ReportsService({ client });
  const csv = await service.export({ ...user, role: UserRole.SECRETARY }, 'member-directory',
    { format: 'csv', membershipType: 'ORDINARY', from: '2026-01-01', to: '2026-12-31' });
  assert.match(csv.data.toString('utf8'), /^\uFEFF/); assert.match(csv.data.toString('utf8'), /"'=2\+2"/);
  assert.match(csv.data.toString('utf8'), /"'@unsafe"/); assert(memberWhere.membershipRecordsByUser.some.startDate);
  await assert.rejects(service.export({ ...user, role: UserRole.TREASURER }, 'membership', { format: 'csv' }),
    error => error.getStatus() === 403);
  const xlsxClient = { payment: { async findMany() { return []; } }, auditLog: { async create() { return {}; } } };
  const xlsx = await new ReportsService({ client: xlsxClient }).export({ ...user, role: UserRole.TREASURER }, 'payment', { format: 'xlsx' });
  assert.equal(xlsx.data.subarray(0, 2).toString(), 'PK'); assert(!xlsx.data.toString().includes('receiptObjectKey'));
});
