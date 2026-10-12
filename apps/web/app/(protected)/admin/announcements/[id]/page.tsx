import { AnnouncementEditor } from '@/components/admin/announcement-workspace';
export default async function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params; return <AnnouncementEditor id={id} />;
}
