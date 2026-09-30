'use client';

import { CreditCard, FileCheck2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import {
  ContentCard,
  PageContainer,
  PageHeading,
  QuickActionTile,
  StatusBadge,
  WelcomeBanner,
} from '@/components/dashboard/dashboard-ui';
import { canReviewApplications, canReviewPayments, humanizeEnum } from '@/lib/roles';

export default function AdminOverviewPage() {
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  const { user } = state;
  const name = user.fullName?.trim() || user.email;
  const applicationAccess = canReviewApplications(user.role);
  const paymentAccess = canReviewPayments(user.role);

  return <PageContainer className="admin-overview-page">
    <PageHeading eyebrow="Committee workspace" title="Administration"
      description="Secure tools for your current MyAIS committee responsibilities." />
    <WelcomeBanner role={humanizeEnum(user.role)} name={name}
      context="MyAIS Connect · Authorized committee workspace" />
    <section className="admin-overview-grid" aria-labelledby="admin-work-areas">
      <header><div><p>Authorized access</p><h2 id="admin-work-areas">Your work areas</h2></div>
        <StatusBadge tone="success"><ShieldCheck size={13} /> Active account</StatusBadge></header>
      <div className="admin-work-area-list">
        {applicationAccess && <QuickActionTile icon={FileCheck2} label="Application review"
          supporting="Open reviewer queue" href="/admin/applications" />}
        {paymentAccess && <QuickActionTile icon={CreditCard} label="Payment verification"
          supporting="Open payment queue" href="/admin/payments" />}
      </div>
      {!applicationAccess && !paymentAccess && <ContentCard className="admin-access-note">
        <ShieldCheck /><div><h3>No operational workspace assigned</h3>
          <p>Your canonical role is active, but no Phase 7A work area is assigned to it.</p></div>
      </ContentCard>}
    </section>
  </PageContainer>;
}
