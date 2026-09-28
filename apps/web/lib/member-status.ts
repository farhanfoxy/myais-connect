const labels: Record<string, string> = {
  DRAFT: 'Draft', SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under review',
  ADDITIONAL_INFORMATION_REQUIRED: 'Information required', ELIGIBLE: 'Eligible',
  RECOMMENDED_FOR_APPROVAL: 'Recommended for approval',
  APPROVED_PENDING_PAYMENT: 'Payment required', PAYMENT_SUBMITTED: 'Payment submitted',
  PAYMENT_UNDER_VERIFICATION: 'Payment under verification', ACTIVE: 'Active',
  REJECTED: 'Rejected', EXPIRED: 'Expired', SUSPENDED: 'Suspended', TERMINATED: 'Terminated',
  NOT_SUBMITTED: 'Not submitted', UNDER_VERIFICATION: 'Under verification', VERIFIED: 'Verified',
};

export function statusLabel(value: string | null | undefined): string {
  if (!value) return 'Not available';
  return labels[value] ?? value.toLowerCase().replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase());
}

const paymentMethodLabels: Record<string, string> = {
  BANK_TRANSFER: 'Bank transfer',
  ONLINE_BANKING: 'Online banking',
  CASH_DEPOSIT: 'Cash deposit',
};

export function paymentMethodLabel(value: string | null | undefined): string {
  if (!value) return 'Not provided';
  return paymentMethodLabels[value] ?? statusLabel(value);
}

export type StatusTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger';

export function statusTone(value: string | null | undefined): StatusTone {
  if (value === 'ACTIVE' || value === 'VERIFIED') return 'success';
  if (value === 'REJECTED' || value === 'TERMINATED') return 'danger';
  if (value === 'ADDITIONAL_INFORMATION_REQUIRED' || value === 'APPROVED_PENDING_PAYMENT') return 'warning';
  if (value === 'SUBMITTED' || value === 'UNDER_REVIEW' || value === 'PAYMENT_SUBMITTED' ||
    value === 'PAYMENT_UNDER_VERIFICATION' || value === 'UNDER_VERIFICATION') return 'info';
  return 'neutral';
}

export function applicationAction(status: string | null | undefined): string {
  if (!status) return 'Start application';
  const actions: Record<string, string> = {
    DRAFT: 'Continue application', SUBMITTED: 'Track application', UNDER_REVIEW: 'Track application',
    ADDITIONAL_INFORMATION_REQUIRED: 'Respond to request', RECOMMENDED_FOR_APPROVAL: 'Track application',
    APPROVED_PENDING_PAYMENT: 'Make payment', PAYMENT_SUBMITTED: 'Track payment',
    PAYMENT_UNDER_VERIFICATION: 'Track payment', ACTIVE: 'View membership card',
  };
  return actions[status] ?? 'View application history';
}
