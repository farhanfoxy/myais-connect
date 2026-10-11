import { EventDetail } from '@/components/events/event-detail';
export default async function EventPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <EventDetail id={id} />;
}
