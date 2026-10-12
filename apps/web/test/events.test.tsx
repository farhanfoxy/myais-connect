// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemberEvents } from '@/components/events/member-events';
import { EventDetail } from '@/components/events/event-detail';
import { AdminEventList } from '@/components/events/admin-event-list';
import { AdminEventEditor } from '@/components/events/admin-event-editor';
import { MyEvents } from '@/components/events/my-events';
import { EventAttendees } from '@/components/events/event-attendees';
import { prepareEventInput } from '@/lib/event-form';
import { eventStatusTone } from '@/lib/events';
import { canManageEvents } from '@/lib/roles';
import type { AdminEventRecord, EventInput, EventRecord } from '@/lib/api-client';

const fixture = vi.hoisted(() => ({
  listEvents: vi.fn(), getEvent: vi.fn(), listAdminEvents: vi.fn(), getAdminEvent: vi.fn(),
  createEvent: vi.fn(), updateEvent: vi.fn(), publishEvent: vi.fn(), cancelEvent: vi.fn(), replace: vi.fn(),
  getOwnEventRegistration: vi.fn(), registerForEvent: vi.fn(), cancelOwnEventRegistration: vi.fn(),
  listOwnEventRegistrations: vi.fn(), listEventAttendees: vi.fn(), checkInEventTicket: vi.fn(),
  manuallyCheckInEventRegistration: vi.fn(), downloadReport: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: fixture.replace }) }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,QR') } }));
vi.mock('@/lib/member-api', () => ({ createMemberApiClient: () => fixture }));
vi.mock('@/lib/admin-api', () => ({ createAdminApiClient: () => fixture }));

const event: EventRecord = {
  id: '11111111-1111-4111-8111-111111111111', eventNumber: 'MYAIS-EVT-2099-0001', title: 'Digital Futures Forum',
  category: 'SEMINARS_AND_WEBINARS', summary: 'A member forum on responsible digital innovation.',
  description: 'Join the MyAIS community for a practical professional discussion.', coverImage: null,
  speakerName: 'Dr Aisyah Rahman', speakerTitle: 'Programme Chair', eventType: 'Forum', venueType: 'HYBRID',
  venueName: 'MyAIS Centre', physicalAddress: 'Kuala Lumpur', startDate: '2099-10-20', startTime: '09:00',
  endDate: '2099-10-20', endTime: '12:00', registrationStart: '2099-09-01', registrationDeadline: '2099-10-18',
  capacity: 100, limitedSeats: true, memberFee: '0', nonMemberFee: '50', currency: 'MYR', paymentInstructions: null,
  status: 'PUBLISHED', targetAudience: 'MEMBERS_AND_NON_MEMBERS', publishedAt: '2099-09-01T00:00:00.000Z',
  cancellationReason: null, placeholderImageNotice: false, timezone: 'Asia/Kuala_Lumpur', registrationAvailable: true,
};
const adminEvent: AdminEventRecord = { ...event, slug: 'digital-futures-forum', onlineMeetingUrl: 'https://example.test/meeting',
  registrationUrl: 'https://example.test/register', createdAt: '2099-08-01T00:00:00.000Z',
  updatedAt: '2099-09-01T00:00:00.000Z', cancelledAt: null };

beforeEach(() => {
  window.sessionStorage.clear();
  fixture.listEvents.mockReset().mockResolvedValue([event]); fixture.getEvent.mockReset().mockResolvedValue(event);
  fixture.listAdminEvents.mockReset().mockResolvedValue({ items: [adminEvent], page: 1, pageSize: 15, total: 1, totalPages: 1 });
  fixture.getAdminEvent.mockReset().mockResolvedValue(adminEvent); fixture.createEvent.mockReset().mockResolvedValue({ ...adminEvent, status: 'DRAFT' });
  fixture.updateEvent.mockReset().mockResolvedValue(adminEvent); fixture.publishEvent.mockReset().mockResolvedValue(adminEvent);
  fixture.cancelEvent.mockReset().mockResolvedValue({ ...adminEvent, status: 'CANCELLED' }); fixture.replace.mockReset();
  fixture.getOwnEventRegistration.mockReset().mockResolvedValue(null);
  fixture.registerForEvent.mockReset().mockResolvedValue({ status: 'REGISTERED', registeredAt: '2099-09-10T01:00:00.000Z',
    checkedInAt: null, ticketCode: 'opaque-ticket-code', event });
  fixture.cancelOwnEventRegistration.mockReset().mockResolvedValue({ status: 'CANCELLED', cancelled: true });
  fixture.listOwnEventRegistrations.mockReset().mockResolvedValue([]);
  fixture.listEventAttendees.mockReset().mockResolvedValue({ event: { id: event.id, eventNumber: event.eventNumber,
    title: event.title, capacity: 100, limitedSeats: true, status: 'PUBLISHED' }, items: [], page: 1, pageSize: 20,
    total: 0, totalPages: 0, registeredCount: 0, attendanceCount: 0 });
  fixture.checkInEventTicket.mockReset().mockResolvedValue({ status: 'ATTENDED', checkedInAt: new Date().toISOString(),
    alreadyCheckedIn: false, message: 'Check-in confirmed' });
  fixture.manuallyCheckInEventRegistration.mockReset(); fixture.downloadReport.mockReset();
});
afterEach(cleanup);

const validEventInput: EventInput = {
  title: ' Supervisor Demo Event ', category: 'SEMINARS_AND_WEBINARS', description: ' A realistic event description. ',
  venueType: 'ONLINE', onlineMeetingUrl: ' https://example.test/session ', startDate: '2026-10-15', startTime: '10:00',
  endDate: '2026-10-15', endTime: '12:00', registrationStart: '2026-10-01', registrationDeadline: '2026-10-10',
  capacity: 100, limitedSeats: true, memberFee: 0, nonMemberFee: 50, currency: 'myr',
  targetAudience: 'MEMBERS_AND_NON_MEMBERS', coverImage: '', registrationUrl: '', summary: '',
};

describe('event form contract', () => {
  it('preserves Malaysia calendar values and normalizes blank optional fields', () => {
    const result = prepareEventInput(validEventInput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({ title: 'Supervisor Demo Event', startDate: '2026-10-15', startTime: '10:00',
      endDate: '2026-10-15', endTime: '12:00', registrationStart: '2026-10-01', registrationDeadline: '2026-10-10',
      coverImage: null, registrationUrl: null, summary: null, currency: 'MYR' });
  });

  it('accepts the source-backed physical venue payload without an online URL', () => {
    const result = prepareEventInput({ ...validEventInput, venueType: 'PHYSICAL', venueName: 'MyAIS Centre',
      physicalAddress: 'Kuala Lumpur', onlineMeetingUrl: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.onlineMeetingUrl).toBeNull();
  });

  it('coerces browser numeric values and rejects an invalid registration window', () => {
    const numeric = prepareEventInput({ ...validEventInput, capacity: '100', memberFee: '10', nonMemberFee: '50' } as unknown as EventInput);
    expect(numeric.success).toBe(true);
    if (numeric.success) expect(numeric.data).toMatchObject({ capacity: 100, memberFee: 10, nonMemberFee: 50 });
    const invalid = prepareEventInput({ ...validEventInput, registrationDeadline: '2026-10-16' });
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.errors.registrationDeadline).toMatch(/before or on the event start date/i);
  });
});

describe('member events', () => {
  it('renders real event cards and a functional detail action', async () => {
    render(<MemberEvents />);
    expect(await screen.findByRole('heading', { name: 'Digital Futures Forum' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /View event/ }).getAttribute('href')).toContain(event.id);
  });

  it('renders an honest empty state', async () => {
    fixture.listEvents.mockResolvedValue([]); render(<MemberEvents />);
    expect(await screen.findByRole('heading', { name: 'No upcoming events yet' })).toBeTruthy();
  });

  it('shows published event detail with the real registration action', async () => {
    render(<EventDetail id={event.id} />);
    expect(await screen.findByRole('heading', { name: 'Digital Futures Forum' })).toBeTruthy();
    expect(screen.getByText('Registration is open')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Register' })).toBeTruthy();
  });

  it('registers through the owner-scoped API and renders the opaque QR ticket', async () => {
    render(<EventDetail id={event.id} />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Register' }));
    await waitFor(() => expect(fixture.registerForEvent).toHaveBeenCalledWith(event.id));
    expect(await screen.findByRole('region', { name: 'Event ticket' })).toBeTruthy();
    expect(screen.getByText('opaque-ticket-code')).toBeTruthy();
  });
});

describe('event operations', () => {
  it('renders member registrations and links to the ticket detail', async () => {
    fixture.listOwnEventRegistrations.mockResolvedValue([{ status: 'REGISTERED', registeredAt: '2099-09-10T01:00:00.000Z',
      checkedInAt: null, ticketCode: 'opaque-ticket-code', event }]);
    render(<MyEvents />);
    expect(await screen.findByRole('heading', { name: event.title })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View ticket' }).getAttribute('href')).toBe(`/events/${event.id}`);
  });

  it('keeps attendee management operational with manual token fallback', async () => {
    render(<EventAttendees id={event.id} />);
    expect(await screen.findByRole('heading', { name: event.title })).toBeTruthy();
    const input = screen.getByPlaceholderText('Scan or enter ticket code');
    await userEvent.setup().type(input, 'opaque-ticket-code');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Check in' }));
    await waitFor(() => expect(fixture.checkInEventTicket).toHaveBeenCalledWith(event.id, 'opaque-ticket-code'));
    expect(await screen.findByText('Check-in confirmed')).toBeTruthy();
  });
});

describe('admin events', () => {
  it.each(['PRESIDENT', 'DEPUTY_PRESIDENT', 'SECRETARY', 'ASSISTANT_SECRETARY', 'SYSTEM_ADMINISTRATOR'])
  ('allows the source-backed %s event manager role', role => expect(canManageEvents(role)).toBe(true));

  it.each(['TREASURER', 'COMMITTEE_MEMBER', 'APPLICANT', 'ORDINARY_MEMBER'])
  ('does not grant event mutation navigation to %s', role => expect(canManageEvents(role)).toBe(false));

  it('renders the operational admin event list', async () => {
    render(<AdminEventList />);
    expect((await screen.findAllByText('Digital Futures Forum')).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Manage/ })[0]?.getAttribute('href')).toContain(event.id);
  });

  it('uses semantic event status presentations', async () => {
    expect(eventStatusTone('PUBLISHED')).toBe('success');
    expect(eventStatusTone('DRAFT')).toBe('warning');
    expect(eventStatusTone('CANCELLED')).toBe('danger');
    fixture.listAdminEvents.mockResolvedValue({ items: [adminEvent, { ...adminEvent, id: 'draft-id', status: 'DRAFT' },
      { ...adminEvent, id: 'cancelled-id', status: 'CANCELLED' }], page: 1, pageSize: 15, total: 3, totalPages: 1 });
    const view = render(<AdminEventList />);
    await screen.findAllByText('Published');
    expect(view.container.querySelector('.status-badge-success')?.textContent).toContain('Published');
    expect(view.container.querySelector('.status-badge-warning')?.textContent).toContain('Draft');
    expect(view.container.querySelector('.status-badge-danger')?.textContent).toContain('Cancelled');
  });

  it('creates a validated draft through the admin API', async () => {
    const user = userEvent.setup(); render(<AdminEventEditor />);
    await user.type(screen.getByLabelText('Event title *'), 'New MyAIS Event');
    await user.type(screen.getByLabelText('Description *'), 'A source-backed event description.');
    await user.type(screen.getByLabelText('Start date *'), '2099-12-01');
    await user.type(screen.getByLabelText('Start time *'), '09:00');
    await user.type(screen.getByLabelText('Online meeting URL'), 'https://example.test/session');
    await user.click(screen.getByRole('button', { name: 'Create draft' }));
    await waitFor(() => expect(fixture.createEvent).toHaveBeenCalledOnce());
    expect(fixture.createEvent.mock.calls[0]?.[0]).not.toHaveProperty('status');
    expect(window.sessionStorage.getItem(`myais:event-created:${event.id}`)).toBe('1');
    expect(fixture.replace).toHaveBeenCalledWith(`/admin/events/${event.id}`);
  });

  it('shows field-specific required and venue errors, focuses the first field, and retains input', async () => {
    const user = userEvent.setup(); render(<AdminEventEditor />);
    await user.type(screen.getByLabelText('Event title *'), 'Retained title');
    await user.type(screen.getByLabelText('Description *'), 'Retained description');
    await user.type(screen.getByLabelText('Start date *'), '2026-10-15');
    await user.type(screen.getByLabelText('Start time *'), '10:00');
    await user.click(screen.getByRole('button', { name: 'Create draft' }));
    expect(await screen.findByText('Online meeting URL is required for online or hybrid events')).toBeTruthy();
    expect((screen.getByLabelText('Event title *') as HTMLInputElement).value).toBe('Retained title');
    expect(document.activeElement).toBe(document.querySelector('[name="onlineMeetingUrl"]'));
    expect(fixture.createEvent).not.toHaveBeenCalled();
  });

  it('updates a published event without sending server-owned fields', async () => {
    const user = userEvent.setup(); render(<AdminEventEditor id={event.id} />);
    const title = await screen.findByLabelText('Event title *');
    await user.clear(title); await user.type(title, 'Updated published event');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(fixture.updateEvent).toHaveBeenCalledOnce());
    expect(fixture.updateEvent.mock.calls[0]?.[1]).toMatchObject({ title: 'Updated published event', coverImage: null });
    expect(fixture.updateEvent.mock.calls[0]?.[1]).not.toHaveProperty('status');
    expect(fixture.updateEvent.mock.calls[0]?.[1]).not.toHaveProperty('eventNumber');
    expect(await screen.findByText('Event updated successfully.')).toBeTruthy();
    expect(screen.getByText('Event updated successfully.').getAttribute('role')).toBe('status');
  });

  it('shows transient create success feedback on the destination editor', async () => {
    window.sessionStorage.setItem(`myais:event-created:${event.id}`, '1');
    render(<AdminEventEditor id={event.id} />);
    const feedback = await screen.findByText('Event created successfully.');
    expect(feedback.getAttribute('role')).toBe('status');
    expect(window.sessionStorage.getItem(`myais:event-created:${event.id}`)).toBeNull();
  });

  it('rejects an invalid date update before calling the API', async () => {
    const user = userEvent.setup(); render(<AdminEventEditor id={event.id} />);
    const endDate = await screen.findByLabelText('End date');
    await user.clear(endDate); await user.type(endDate, '2099-10-19');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('End must be after the event start')).toBeTruthy();
    expect(fixture.updateEvent).not.toHaveBeenCalled();
  });

  it('shows a safe mutation error', async () => {
    fixture.createEvent.mockRejectedValue(new Error('private database detail'));
    const user = userEvent.setup(); render(<AdminEventEditor />);
    await user.type(screen.getByLabelText('Event title *'), 'New MyAIS Event');
    await user.type(screen.getByLabelText('Description *'), 'A source-backed event description.');
    await user.type(screen.getByLabelText('Start date *'), '2099-12-01');
    await user.type(screen.getByLabelText('Start time *'), '09:00');
    await user.type(screen.getByLabelText('Online meeting URL'), 'https://example.test/session');
    await user.click(screen.getByRole('button', { name: 'Create draft' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('We could not save the event');
    expect(document.body.textContent).not.toContain('private database detail');
    expect((screen.getByLabelText('Event title *') as HTMLInputElement).value).toBe('New MyAIS Event');
  });
});
