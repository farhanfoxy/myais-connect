import { AdminEventEditor } from '@/components/events/admin-event-editor';
export default async function EditEventPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <AdminEventEditor id={id} />;
}
