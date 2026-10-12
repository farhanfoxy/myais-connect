import { MemberDetail } from '@/components/admin/member-detail';

export default async function AdminMemberDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <MemberDetail id={id} />;
}
