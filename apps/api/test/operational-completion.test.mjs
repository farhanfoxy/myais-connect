import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { AdminMembersController, memberDirectoryRoles } from '../dist/admin-members/admin-members.controller.js';
import { AdminMembersService } from '../dist/admin-members/admin-members.service.js';
import { auditViewerRoles } from '../dist/audit-logs/audit-logs.controller.js';
import { EventRegistrationsService } from '../dist/events/event-registrations.service.js';
import { eventManagerRoles } from '../dist/events/events.controller.js';

const eventId = '11111111-1111-4111-8111-111111111111';
const otherEventId = '22222222-2222-4222-8222-222222222222';
const owner = { id: '33333333-3333-4333-8333-333333333333', email: 'member@example.test', fullName: 'Member One',
  role: 'ORDINARY_MEMBER', accountStatus: 'ACTIVE' };
const secondMember = { ...owner, id: '44444444-4444-4444-8444-444444444444', email: 'second@example.test' };
const manager = { ...owner, id: '55555555-5555-4555-8555-555555555555', role: 'SECRETARY' };

function event(overrides = {}) {
  return { id: eventId, title: 'MyAIS Forum', status: 'PUBLISHED', startDate: new Date('2099-10-20T00:00:00Z'),
    registrationStart: null, registrationDeadline: new Date('2099-10-18T00:00:00Z'), limitedSeats: true,
    capacity: 20, targetAudience: 'MEMBERS_AND_NON_MEMBERS', eventNumber: 'MYAIS-EVT-2099-0001',
    summary: null, startTime: '09:00', endDate: null, endTime: null, venueType: 'PHYSICAL', venueName: 'Kuala Lumpur',
    physicalAddress: null, timezone: 'Asia/Kuala_Lumpur', cancellationReason: null, ...overrides };
}

function registrationDatabase(eventRows = [event()]) {
  const registrations = []; const notifications = []; const audits = []; let transactionQueue = Promise.resolve();
  const events = eventRows.map(item => ({ ...item }));
  function selected(registration) {
    return { status: registration.status, registeredAt: registration.registeredAt, ticketCode: registration.ticketCode,
      checkedInAt: registration.checkedInAt, event: events.find(item => item.id === registration.eventId) };
  }
  const client = {
    event: { async findUnique({ where }) { return events.find(item => item.id === where.id) ?? null; } },
    eventRegistration: {
      async findUnique({ where }) { const key = where.eventId_userId;
        const row = registrations.find(item => item.eventId === key.eventId && item.userId === key.userId);
        return row ? { ...row, event: events.find(item => item.id === row.eventId) } : null; },
      async findFirst({ where }) { return registrations.find(item => item.eventId === where.eventId &&
        ('id' in where ? item.id === where.id : item.ticketCode === where.ticketCode)) ?? null; },
      async count({ where }) { return registrations.filter(item => item.eventId === where.eventId &&
        (!where.status?.in || where.status.in.includes(item.status))).length; },
      async create({ data }) { const row = { id: randomUUID(), checkedInAt: null, ...data };
        registrations.push(row); return selected(row); },
      async update({ where, data }) { const row = registrations.find(item => item.id === where.id ||
        (where.eventId_userId && item.eventId === where.eventId_userId.eventId && item.userId === where.eventId_userId.userId));
        Object.assign(row, data); return selected(row); },
    },
    notification: { async create({ data }) { notifications.push(data); return data; } },
    auditLog: { async create({ data }) { audits.push(data); return data; } },
    async $queryRaw() { return [{ lock: 'ok' }]; },
    $transaction(callback) { const result = transactionQueue.then(() => callback(client));
      transactionQueue = result.catch(() => undefined); return result; },
  };
  return { registrations, notifications, audits, service: new EventRegistrationsService({ client }) };
}

test('event registration enforces source state, uniqueness, capacity and owner-only cancellation', async () => {
  const db = registrationDatabase();
  const created = await db.service.register(owner, eventId);
  assert.equal(created.status, 'REGISTERED');
  assert.match(created.ticketCode, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(db.notifications[0].eventType, 'EVENT_REGISTRATION_CONFIRMED');
  assert.equal(db.audits[0].action, 'EVENT_REGISTRATION_CONFIRMED');
  await assert.rejects(db.service.register(owner, eventId), error => error.getStatus() === 409);
  await assert.rejects(db.service.cancelOwn(secondMember, eventId), error => error.getStatus() === 404);
  assert.equal((await db.service.cancelOwn(owner, eventId)).status, 'CANCELLED');
  assert.equal(db.notifications.at(-1).eventType, 'EVENT_REGISTRATION_CANCELLED');

  for (const blockedEvent of [event({ status: 'DRAFT' }), event({ status: 'CANCELLED' }),
    event({ registrationDeadline: new Date('2020-01-01T00:00:00Z') })]) {
    const blocked = registrationDatabase([blockedEvent]);
    await assert.rejects(blocked.service.register(owner, eventId), error => error.getStatus() === 409);
  }
  const full = registrationDatabase([event({ capacity: 0 })]);
  await assert.rejects(full.service.register(owner, eventId), error => error.getStatus() === 409);
});

test('event capacity transaction serializes concurrent attempts for the final slot', async () => {
  const db = registrationDatabase([event({ capacity: 1 })]);
  const results = await Promise.allSettled([db.service.register(owner, eventId), db.service.register(secondMember, eventId)]);
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(results.filter(item => item.status === 'rejected').length, 1);
  assert.equal(db.registrations.filter(item => item.status === 'REGISTERED').length, 1);
});

test('QR and manual check-in validate event/token/state and remain duplicate-safe', async () => {
  const db = registrationDatabase([event(), event({ id: otherEventId, eventNumber: 'MYAIS-EVT-2099-0002' })]);
  const ticket = await db.service.register(owner, eventId);
  await assert.rejects(db.service.qrCheckIn(manager, eventId, { ticketCode: `${ticket.ticketCode}x` }),
    error => error.getStatus() === 404);
  await assert.rejects(db.service.qrCheckIn(manager, otherEventId, { ticketCode: ticket.ticketCode }),
    error => error.getStatus() === 404);
  const checkedIn = await db.service.qrCheckIn(manager, eventId, { ticketCode: ticket.ticketCode });
  assert.equal(checkedIn.status, 'ATTENDED'); assert.equal(checkedIn.alreadyCheckedIn, false);
  assert.equal(db.notifications.at(-1).eventType, 'EVENT_CHECKED_IN');
  assert.equal(db.audits.at(-1).action, 'EVENT_QR_CHECK_IN');
  const repeated = await db.service.manualCheckIn(manager, eventId, db.registrations[0].id);
  assert.deepEqual({ alreadyCheckedIn: repeated.alreadyCheckedIn, message: repeated.message },
    { alreadyCheckedIn: true, message: 'Already checked in' });

  const manual = registrationDatabase();
  await manual.service.register(owner, eventId);
  const manuallyCheckedIn = await manual.service.manualCheckIn(manager, eventId, manual.registrations[0].id);
  assert.equal(manuallyCheckedIn.alreadyCheckedIn, false);
  assert.equal(manual.audits.at(-1).action, 'EVENT_MANUAL_CHECK_IN');

  const cancelled = registrationDatabase();
  const cancelledTicket = await cancelled.service.register(owner, eventId);
  await cancelled.service.cancelOwn(owner, eventId);
  await assert.rejects(cancelled.service.qrCheckIn(manager, eventId, { ticketCode: cancelledTicket.ticketCode }),
    error => error.getStatus() === 409);
});

test('directory and operational role policies remain exact', () => {
  assert.deepEqual([...memberDirectoryRoles], ['PRESIDENT', 'DEPUTY_PRESIDENT', 'SECRETARY',
    'ASSISTANT_SECRETARY', 'SYSTEM_ADMINISTRATOR']);
  assert.deepEqual([...eventManagerRoles], [...memberDirectoryRoles]);
  assert.deepEqual([...auditViewerRoles], ['SYSTEM_ADMINISTRATOR', 'PRESIDENT']);
  assert.equal(memberDirectoryRoles.includes('TREASURER'), false);
  assert.equal(memberDirectoryRoles.includes('COMMITTEE_MEMBER'), false);
  assert.equal(AdminMembersController.prototype.list instanceof Function, true);
});

test('member directory is server-paginated, membership-scoped, one-user-one-row and safely projected', async () => {
  const calls = {}; const userId = owner.id; const membershipRows = [
    { id: '66666666-6666-4666-8666-666666666666', userId, membershipNumber: 'MYAIS-0001',
      membershipTypeCode: 'ORDINARY', membershipTypeName: 'Ordinary Member', status: 'ACTIVE',
      startDate: new Date('2026-01-01'), expiryDate: new Date('2099-12-31'), activatedAt: new Date('2026-01-01'),
      createdAt: new Date('2026-01-01'), membershipType: { code: 'ORDINARY', name: 'Ordinary Member' } },
    { id: '77777777-7777-4777-8777-777777777777', userId, membershipNumber: 'OLD-0001',
      membershipTypeCode: 'ASSOCIATE', membershipTypeName: 'Associate Member', status: 'EXPIRED',
      startDate: new Date('2025-01-01'), expiryDate: new Date('2025-12-31'), activatedAt: new Date('2025-01-01'),
      createdAt: new Date('2025-01-01'), membershipType: { code: 'ASSOCIATE', name: 'Associate Member' } },
  ];
  const client = { user: {
    findMany(args) { calls.findMany = args; return [{ id: userId, fullName: '=Member One', email: owner.email,
      accountStatus: 'ACTIVE', createdAt: new Date('2024-01-01') }]; }, count(args) { calls.count = args; return 1; },
  }, membership: { findMany(args) { calls.memberships = args; return membershipRows; } },
  $transaction(input) { return Promise.all(input); } };
  const page = await new AdminMembersService({ client }).list({ page: '2', pageSize: '15', search: 'Member',
    membershipType: 'ORDINARY', membershipStatus: 'ACTIVE', accountStatus: 'ACTIVE', sort: 'name', order: 'asc' });
  assert.equal(page.items.length, 1); assert.equal(page.items[0].membership.membershipNumber, 'MYAIS-0001');
  assert.equal(calls.findMany.skip, 15); assert.equal(calls.findMany.take, 15);
  assert.deepEqual(calls.findMany.select, { id: true, fullName: true, email: true, accountStatus: true, createdAt: true });
  assert.ok(calls.findMany.where.membershipRecordsByUser.some);
  assert.equal('phoneNumber' in page.items[0], false);
});

test('member detail returns intended histories without technical secrets', async () => {
  const now = new Date('2026-10-12T00:00:00Z'); const membership = { id: '66666666-6666-4666-8666-666666666666',
    membershipNumber: 'MYAIS-0001', membershipTypeCode: 'ORDINARY', membershipTypeName: 'Ordinary Member', status: 'ACTIVE',
    startDate: now, expiryDate: new Date('2099-12-31'), activatedAt: now, createdAt: now,
    membershipType: { code: 'ORDINARY', name: 'Ordinary Member' } };
  const user = { id: owner.id, fullName: owner.fullName, email: owner.email, phoneNumber: null, photoUrl: null,
    role: owner.role, accountStatus: 'ACTIVE', createdAt: now, memberProfileByUser: { city: 'KL', state: null,
      country: 'Malaysia', institution: null, occupation: null, department: null, areaOfExpertise: null },
    membershipRecordsByUser: [membership], membershipApplicationRecordsByUser: [{ id: eventId,
      applicationNumber: 'MYAIS-APP-2026-000001', status: 'ACTIVE', requestedMembershipTypeCode: 'ORDINARY',
      submittedAt: now, approvedAt: now, rejectedAt: null, createdAt: now }], paymentRecordsByUser: [],
    eventRegistrationRecordsByUser: [], supabaseAuthUserId: 'must-not-leak', storageObjectKey: 'must-not-leak' };
  const client = { user: { findUnique() { return user; } }, auditLog: { findMany() { return []; } } };
  const result = await new AdminMembersService({ client }).detail(owner.id);
  assert.equal(result.membershipHistory.length, 1); assert.equal(result.applicationHistory.length, 1);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('supabaseAuthUserId'), false); assert.equal(serialized.includes('storageObjectKey'), false);
  assert.equal(serialized.includes('must-not-leak'), false);
});
