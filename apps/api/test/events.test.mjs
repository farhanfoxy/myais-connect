import assert from 'node:assert/strict';
import test from 'node:test';
import { Reflector } from '@nestjs/core';
import { ActiveAccountGuard } from '../dist/auth/active-account.guard.js';
import { RolesGuard } from '../dist/auth/roles.guard.js';
import { AdminEventsController, eventManagerRoles } from '../dist/events/events.controller.js';
import { EventsService } from '../dist/events/events.service.js';

const eventId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const actor = { id: actorId, email: 'secretary@example.test', fullName: 'MyAIS Secretary', photoUrl: null,
  role: 'SECRETARY', accountStatus: 'ACTIVE', supabaseAuthUserId: '33333333-3333-4333-8333-333333333333' };

const baseEvent = {
  id: eventId, eventNumber: 'MYAIS-EVT-2099-0001', title: 'Digital Futures Forum', slug: 'digital-futures-forum',
  category: 'CONFERENCES', summary: 'A professional forum', description: 'Source-backed event details.', coverImage: null,
  speakerName: null, speakerTitle: null, eventType: 'Forum', venueType: 'ONLINE', venueName: null,
  physicalAddress: null, onlineMeetingUrl: 'https://example.test/private-meeting', startDate: new Date('2099-10-20T00:00:00Z'),
  startTime: '09:00', endDate: null, endTime: null, registrationStart: null,
  registrationDeadline: new Date('2099-10-18T00:00:00Z'), capacity: 100, limitedSeats: true,
  memberFee: { toString: () => '0' }, nonMemberFee: { toString: () => '50' }, currency: 'MYR',
  paymentInstructions: null, registrationUrl: 'https://example.test/register', status: 'PUBLISHED',
  targetAudience: 'MEMBERS_AND_NON_MEMBERS', publishedAt: new Date('2099-09-01T00:00:00Z'), cancelledAt: null,
  cancellationReason: null, placeholderImageNotice: false, timezone: 'Asia/Kuala_Lumpur',
  createdAt: new Date('2099-08-01T00:00:00Z'), updatedAt: new Date('2099-09-01T00:00:00Z'),
};

const validInput = {
  title: 'New MyAIS Event', category: 'WORKSHOPS', description: 'A complete event description.', venueType: 'ONLINE',
  onlineMeetingUrl: 'https://example.test/session', startDate: '2099-12-01', startTime: '09:00',
  limitedSeats: false, memberFee: 0, nonMemberFee: 0, currency: 'MYR', targetAudience: 'MEMBERS_AND_NON_MEMBERS',
};

function project(row, select) {
  return Object.fromEntries(Object.keys(select).filter(key => select[key] === true).map(key => [key, row[key]]));
}

function database(seed = [baseEvent], registeredUsers = []) {
  const events = seed.map(item => ({ ...item }));
  const audits = [];
  const notifications = [];
  const eventApi = {
    async findMany(args = {}) {
      let rows = events.filter(item => !args.where?.status || item.status === args.where.status);
      if (args.where?.startDate?.gte) rows = rows.filter(item => item.startDate >= args.where.startDate.gte);
      if (args.where?.eventNumber?.startsWith) rows = rows.filter(item => item.eventNumber?.startsWith(args.where.eventNumber.startsWith));
      return rows.slice(args.skip || 0, (args.skip || 0) + (args.take || rows.length)).map(item => project(item, args.select));
    },
    async findFirst({ where, select }) {
      const row = events.find(item => item.id === where.id && item.status === where.status);
      return row ? project(row, select) : null;
    },
    async findUnique({ where, select }) {
      const row = events.find(item => item.id === where.id);
      return row ? project(row, select) : null;
    },
    async count() { return events.length; },
    async create({ data, select }) {
      const row = { ...baseEvent, ...data, id: '44444444-4444-4444-8444-444444444444', createdAt: new Date(), updatedAt: new Date(),
        publishedAt: null, cancelledAt: null, cancellationReason: null, memberFee: { toString: () => String(data.memberFee) },
        nonMemberFee: { toString: () => String(data.nonMemberFee) } };
      events.push(row); return project(row, select);
    },
    async update({ where, data, select }) {
      const index = events.findIndex(item => item.id === where.id);
      events[index] = { ...events[index], ...data, updatedAt: new Date() };
      return project(events[index], select);
    },
  };
  const client = {
    event: eventApi,
    eventRegistration: { async findMany() { return registeredUsers.map(userId => ({ userId })); } },
    user: { async findMany() { return [{ id: '99999999-9999-4999-8999-999999999999' }]; } },
    notification: { async createMany({ data }) { notifications.push(...data); return { count: data.length }; } },
    auditLog: { async create({ data }) { audits.push(data); return data; } },
    async $queryRaw() { return [{ lock: 'ok' }]; },
    async $transaction(input) {
      if (typeof input === 'function') return input(client);
      return Promise.all(input);
    },
  };
  return { events, audits, notifications, service: new EventsService({ client }) };
}

function context(principal, handler = AdminEventsController.prototype.create) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ principal }) }),
    getHandler: () => handler,
    getClass: () => AdminEventsController,
  };
}

test('member event reads expose only upcoming PUBLISHED safe projections', async () => {
  const draft = { ...baseEvent, id: '55555555-5555-4555-8555-555555555555', status: 'DRAFT' };
  const db = database([baseEvent, draft]);
  const list = await db.service.memberList({ limit: '2' });
  assert.equal(list.length, 1);
  assert.equal(list[0].status, 'PUBLISHED');
  assert.equal(list[0].registrationAvailable, true);
  assert.equal('onlineMeetingUrl' in list[0], false);
  assert.equal('registrationUrl' in list[0], false);
  const detail = await db.service.memberDetail(eventId);
  assert.equal(detail.title, 'Digital Futures Forum');
  await assert.rejects(db.service.memberDetail(draft.id), error => error.getStatus() === 404);
});

test('event-manager role policy is exact and inactive accounts are denied', () => {
  assert.deepEqual([...eventManagerRoles], ['PRESIDENT', 'DEPUTY_PRESIDENT', 'SECRETARY', 'ASSISTANT_SECRETARY', 'SYSTEM_ADMINISTRATOR']);
  const roles = new RolesGuard(new Reflector());
  for (const role of eventManagerRoles) assert.equal(roles.canActivate(context({ ...actor, role })), true);
  for (const role of ['TREASURER', 'COMMITTEE_MEMBER', 'APPLICANT']) {
    assert.throws(() => roles.canActivate(context({ ...actor, role })), error => error.getStatus() === 403);
  }
  assert.throws(() => new ActiveAccountGuard().canActivate(context({ ...actor, accountStatus: 'SUSPENDED' })),
    error => error.getStatus() === 403);
});

test('create validates source fields, derives ownership and creates a DRAFT with an audit event', async () => {
  const db = database([]);
  await assert.rejects(db.service.create(actor, { ...validInput, startTime: '' }), error => error.getStatus() === 400);
  await assert.rejects(db.service.create(actor, { ...validInput, memberFee: -1 }), error => error.getStatus() === 400);
  await assert.rejects(db.service.create(actor, { ...validInput, endDate: '2099-11-30', endTime: '08:00' }),
    error => error.getStatus() === 400);
  await assert.rejects(db.service.create(actor, { ...validInput, createdByUserId: 'attacker' }), error => error.getStatus() === 400);
  const created = await db.service.create(actor, validInput);
  assert.equal(created.status, 'DRAFT');
  assert.match(created.eventNumber, /^MYAIS-EVT-\d{4}-0001$/);
  assert.equal(db.events.at(-1).createdByUserId, actorId);
  assert.equal(db.audits.at(-1).action, 'EVENT_CREATED');
});

test('update validation and status transitions are server-enforced', async () => {
  const draft = { ...baseEvent, status: 'DRAFT' };
  const db = database([draft]);
  await assert.rejects(db.service.update(actor, eventId, { ...validInput, registrationStart: '2099-12-02',
    registrationDeadline: '2099-12-01' }), error => error.getStatus() === 400);
  const updated = await db.service.update(actor, eventId, { ...validInput, title: 'Updated Event' });
  assert.equal(updated.title, 'Updated Event');
  const published = await db.service.publish(actor, eventId);
  assert.equal(published.status, 'PUBLISHED');
  assert.equal(db.notifications[0].eventType, 'EVENT_PUBLISHED');
  await assert.rejects(db.service.publish(actor, eventId), error => error.getStatus() === 409);
  const cancelled = await db.service.cancel(actor, eventId, { reason: 'Venue unavailable' });
  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal(cancelled.cancellationReason, 'Venue unavailable');
  await assert.rejects(db.service.cancel(actor, eventId, { reason: 'Again' }), error => error.getStatus() === 409);
});

test('event cancellation notifies each registered user with the canonical event notification', async () => {
  const db = database([baseEvent], ['77777777-7777-4777-8777-777777777777']);
  await db.service.cancel(actor, eventId, { reason: 'Venue unavailable' });
  assert.equal(db.notifications.length, 1);
  assert.equal(db.notifications[0].eventType, 'EVENT_CANCELLED');
  assert.equal(db.notifications[0].userId, '77777777-7777-4777-8777-777777777777');
});

test('published event details remain editable without changing lifecycle state', async () => {
  const db = database([baseEvent]);
  const updated = await db.service.update(actor, eventId, { ...validInput, title: 'Updated Published Event',
    coverImage: null, registrationUrl: null });
  assert.equal(updated.title, 'Updated Published Event');
  assert.equal(updated.status, 'PUBLISHED');
  assert.equal(db.events[0].coverImage, null);
  assert.equal(db.events[0].registrationUrl, null);
  assert.equal(db.audits.at(-1).action, 'EVENT_UPDATED');
});

test('admin listing is paginated and returns no creator or migration metadata', async () => {
  const page = await database().service.adminList({ page: '1', pageSize: '15', search: '', category: 'ALL', status: 'ALL' });
  assert.equal(page.total, 1);
  assert.equal(page.items[0].title, 'Digital Futures Forum');
  assert.equal('createdByUserId' in page.items[0], false);
  assert.equal('legacyBase44Id' in page.items[0], false);
});
