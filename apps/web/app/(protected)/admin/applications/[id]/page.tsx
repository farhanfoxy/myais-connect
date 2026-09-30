import { ApplicationReviewDetail } from '@/components/admin/application-review-detail';

export default async function AdminApplicationDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <ApplicationReviewDetail applicationId={id} />;
}
