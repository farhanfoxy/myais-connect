import type { EventCategory, EventRecord } from '@/lib/api-client';
import type { StatusTone } from '@/lib/member-status';

export const eventCategories: Array<{ value: EventCategory; label: string }> = [
  { value: 'SEMINARS_AND_WEBINARS', label: 'Seminars and Webinars' },
  { value: 'WORKSHOPS', label: 'Workshops' },
  { value: 'MEETINGS', label: 'Meetings' },
  { value: 'MYDCIS', label: 'MyDCIS' },
  { value: 'CONFERENCES', label: 'Conferences' },
  { value: 'OTHER', label: 'Other' },
];

export function eventCategoryLabel(value: string): string {
  return eventCategories.find(item => item.value === value)?.label ?? value;
}

export function eventDateLabel(event: Pick<EventRecord, 'startDate' | 'endDate'>): string {
  const start = new Date(`${event.startDate}T00:00:00+08:00`);
  const end = event.endDate ? new Date(`${event.endDate}T00:00:00+08:00`) : null;
  const formatter = new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' });
  return end && event.endDate !== event.startDate ? `${formatter.format(start)} – ${formatter.format(end)}` : formatter.format(start);
}

export function eventFeeLabel(value: string | null, currency: string | null): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount === 0) return 'Free';
  return currency === 'MYR' ? `RM ${amount.toFixed(2)}` : `${currency || ''} ${amount.toFixed(2)}`.trim();
}

export function eventVenueLabel(event: Pick<EventRecord, 'venueType' | 'venueName'>): string {
  if (event.venueType === 'ONLINE') return 'Online';
  if (event.venueType === 'HYBRID') return event.venueName ? `Hybrid · ${event.venueName}` : 'Hybrid';
  return event.venueName || 'Physical venue';
}

export function eventStatusTone(value: string): StatusTone {
  if (value === 'PUBLISHED') return 'success';
  if (value === 'DRAFT') return 'warning';
  if (value === 'CANCELLED') return 'danger';
  return 'neutral';
}
