'use client';

import { Clock3, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { humanizeEnum } from '@/lib/roles';

export default function AdminPlaceholderPage() {
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  return (
    <div className="admin-placeholder-page">
      <section className="admin-welcome">
        <span className="admin-icon"><ShieldCheck /></span>
        <div><p>Authorized committee access</p><h2>Welcome to the MyAIS administration area.</h2>
          <span>Your canonical role is <strong>{humanizeEnum(state.user.role)}</strong>.</span></div>
      </section>
      <section className="admin-coming-soon">
        <span><Clock3 /></span><div><h3>Review tools are coming next</h3>
          <p>The reviewer queue and payment verification screens are intentionally not included in Phase 6A.</p></div>
        <div className="security-note"><LockKeyhole size={17} /> API authorization remains enforced server-side.</div>
      </section>
    </div>
  );
}
