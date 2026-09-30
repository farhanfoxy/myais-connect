import { PaymentReviewDetail } from '@/components/admin/payment-review-detail';

export default async function AdminPaymentDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <PaymentReviewDetail paymentId={id} />;
}
