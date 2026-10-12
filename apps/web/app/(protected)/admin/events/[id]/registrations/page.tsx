import { EventAttendees } from '@/components/events/event-attendees';

export default async function EventAttendeesPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <EventAttendees id={id} />;
}
