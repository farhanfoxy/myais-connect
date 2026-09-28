'use client';

import { Clock3, LockKeyhole } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { ContentCard, PageContainer, PageHeading, StatusBadge, WelcomeBanner } from '@/components/dashboard/dashboard-ui';
import { humanizeEnum } from '@/lib/roles';

export default function AdminPlaceholderPage() {
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  const name = state.user.fullName?.trim() || state.user.email;
  return <PageContainer className="admin-placeholder-page">
    <PageHeading eyebrow="Committee workspace" title="Administration"
      description="Secure access for authorized MyAIS committee responsibilities." />
    <WelcomeBanner role={humanizeEnum(state.user.role)} name={name}
      context="MyAIS Connect · Authorized committee workspace" />
    <ContentCard className="admin-coming-soon"><span className="application-preview-icon"><Clock3 /></span>
      <div><h3>Review tools are coming next</h3>
        <p>The reviewer queue and payment verification screens remain intentionally outside Phase 6A.</p></div>
      <StatusBadge tone="success"><LockKeyhole size={13} /> API access enforced</StatusBadge></ContentCard>
  </PageContainer>;
}
