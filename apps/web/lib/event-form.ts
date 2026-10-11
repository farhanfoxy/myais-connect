import { eventInputSchema } from '@myais/validation';
import type { EventInput } from '@/lib/api-client';

export type EventFieldErrors = Record<string, string>;
export type PreparedEventInput = { success: true; data: EventInput } | { success: false; errors: EventFieldErrors };

const optionalTextFields = [
  'summary', 'coverImage', 'speakerName', 'speakerTitle', 'eventType', 'venueName', 'physicalAddress',
  'onlineMeetingUrl', 'endDate', 'endTime', 'registrationStart', 'registrationDeadline', 'paymentInstructions',
  'registrationUrl',
] as const;

export function prepareEventInput(input: EventInput): PreparedEventInput {
  const rawCapacity = input.capacity as unknown;
  const candidate: Record<string, unknown> = { ...input,
    title: input.title.trim(), description: input.description.trim(), currency: input.currency.trim().toUpperCase(),
    capacity: rawCapacity === null || rawCapacity === undefined || rawCapacity === '' ? null : Number(rawCapacity),
    memberFee: Number(input.memberFee), nonMemberFee: Number(input.nonMemberFee), limitedSeats: Boolean(input.limitedSeats),
  };
  for (const field of optionalTextFields) {
    const value = input[field];
    candidate[field] = typeof value === 'string' && value.trim() ? value.trim() : null;
  }
  const parsed = eventInputSchema.safeParse(candidate);
  if (parsed.success) return { success: true, data: parsed.data as EventInput };
  const errors: EventFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? 'form');
    errors[field] ??= issue.message;
  }
  return { success: false, errors };
}
