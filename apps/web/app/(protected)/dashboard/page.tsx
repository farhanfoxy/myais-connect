'use client';

import { ArrowRight, CheckCircle2, Clock3, FileText, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { humanizeEnum } from '@/lib/roles';

const upcomingActions = [
  { icon: UserRound, title: 'Complete your profile', copy: 'Add your professional and contact details.', phase: 'Available in Phase 6B' },
  { icon: FileText, title: 'Start an application', copy: 'Review eligibility and select a membership type.', phase: 'Available in Phase 6B' },
];

export default function DashboardPage() {
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  const { user } = state;
  const displayName = user.fullName?.trim() || user.email.split('@')[0] || 'Member';

  return (
    <div className="dashboard-page">
      <section className="welcome-panel">
        <div className="welcome-copy">
          <span className="welcome-eyebrow"><CheckCircle2 size={16} /> Secure workspace ready</span>
          <h2>Welcome, {displayName}.</h2>
          <p>Your MyAIS membership workspace is ready. Profile and application tools will arrive in the next phase.</p>
        </div>
        <div className="welcome-emblem" aria-hidden="true"><span>MY</span><strong>AIS</strong></div>
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-main">
          <div className="section-heading"><div><p>Getting started</p><h3>Your next steps</h3></div>
            <span className="quiet-badge"><Clock3 size={14} /> Coming next</span></div>
          <div className="action-card-grid">
            {upcomingActions.map(({ icon: Icon, title, copy, phase }) => (
              <article className="action-card" key={title}>
                <span className="action-icon"><Icon size={22} /></span>
                <div><h4>{title}</h4><p>{copy}</p><small>{phase}</small></div>
                <ArrowRight className="action-arrow" size={19} />
              </article>
            ))}
          </div>
          <div className="empty-workspace-state">
            <span><FileText size={23} /></span>
            <div><h3>No business data shown yet</h3><p>Application, payment and membership information will appear only after their dedicated screens query the NestJS API.</p></div>
          </div>
        </section>

        <aside className="account-summary">
          <div className="section-heading"><div><p>Canonical account</p><h3>Your access</h3></div><ShieldCheck size={20} /></div>
          <dl>
            <div><dt>Name</dt><dd>{user.fullName ?? 'Complete during profile setup'}</dd></div>
            <div><dt>Email</dt><dd>{user.email}</dd></div>
            <div><dt>Role</dt><dd><span className="role-badge">{humanizeEnum(user.role)}</span></dd></div>
            <div><dt>Account status</dt><dd><span className="active-badge"><span />{humanizeEnum(user.accountStatus)}</span></dd></div>
          </dl>
          <p className="account-note">Role and account access are verified by the MyAIS API for every protected session.</p>
        </aside>
      </div>
    </div>
  );
}
