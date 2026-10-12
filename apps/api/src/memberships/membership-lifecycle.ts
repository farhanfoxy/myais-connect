export interface MembershipLifecycleRecord {
  id: string;
  status: string | null;
  expiryDate: Date | null;
  membershipTypeCode?: string | null;
  createdAt: Date;
}

const malaysiaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function malaysiaCalendarDate(value = new Date()): string {
  const parts = malaysiaDateFormatter.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function isMembershipExpired(record: Pick<MembershipLifecycleRecord, 'status' | 'expiryDate'>,
  today = malaysiaCalendarDate()): boolean {
  return record.status === 'EXPIRED' || Boolean(record.status === 'ACTIVE' && record.expiryDate &&
    record.expiryDate.toISOString().slice(0, 10) < today);
}

export function visibleMembershipStatus(record: Pick<MembershipLifecycleRecord, 'status' | 'expiryDate'>,
  today = malaysiaCalendarDate()): string | null {
  return isMembershipExpired(record, today) ? 'EXPIRED' : record.status;
}

export function isActiveMembership(record: Pick<MembershipLifecycleRecord, 'status' | 'expiryDate'>,
  today = malaysiaCalendarDate()): boolean {
  return record.status === 'ACTIVE' && !isMembershipExpired(record, today);
}

export function isNoExpiryMembership(record: Pick<MembershipLifecycleRecord, 'expiryDate'>): boolean {
  return record.expiryDate === null;
}

export function resolveCurrentMembership<T extends MembershipLifecycleRecord>(records: readonly T[],
  today = malaysiaCalendarDate()): T | null {
  return records.find(record => isActiveMembership(record, today)) ?? records[0] ?? null;
}
