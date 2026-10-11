import type { ReactNode } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Check, LockKeyhole } from 'lucide-react';
import { OfficialMyaisMark } from '@/components/brand-mark';
import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/member-status';

export function PageContainer({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return <div className={cn('page-container', className)}>{children}</div>;
}

export function PageHeading({ eyebrow, title, description }: Readonly<{
  eyebrow: string; title: string; description: string;
}>) {
  return <header className="page-heading"><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></header>;
}

export function WelcomeBanner({ role, name, context, membershipActive = false }: Readonly<{
  role: string; name: string; context: string; membershipActive?: boolean;
}>) {
  return <section className="welcome-banner"><div><div className="welcome-role-row"><span className="welcome-role">{role}</span>
    {membershipActive && <span className="welcome-membership-status"><i />Membership Active</span>}</div>
    <h2>Welcome back, {name}.</h2><p>{context}</p></div>
    <OfficialMyaisMark className="welcome-brand" decorative /></section>;
}

export function StatusBadge({ children, tone = 'neutral' }: Readonly<{
  children: ReactNode; tone?: StatusTone;
}>) {
  return <span className={cn('status-badge', `status-badge-${tone}`)}><i />{children}</span>;
}

export function SummaryCard({ icon: Icon, label, value, supporting }: Readonly<{
  icon: LucideIcon; label: string; value: string; supporting?: string;
}>) {
  return <article className="summary-card"><span className="summary-icon"><Icon size={19} /></span>
    <div><p>{label}</p><strong>{value}</strong>{supporting && <span>{supporting}</span>}</div></article>;
}

export interface JourneyStep {
  label: string;
  detail: string;
  state: 'complete' | 'current' | 'attention' | 'upcoming';
}

export function MembershipJourney({ steps, nextAction, nextHref, compact = false }: Readonly<{
  steps: JourneyStep[]; nextAction: string; nextHref?: string; compact?: boolean;
}>) {
  const completed = steps.filter(step => step.state === 'complete').length;
  const progress = Math.round((completed / steps.length) * 100);
  return <section className={cn('journey-card', compact && 'journey-card-compact')} aria-labelledby="membership-journey-heading">
    <header><div><p>Membership journey</p><h2 id="membership-journey-heading">Your progress</h2></div>
      {nextHref ? <Link className="journey-next-action" href={nextHref}>Next: <strong>{nextAction}</strong>
        <ArrowRight size={13} /></Link> : <span className="journey-next-action">Next: <strong>{nextAction}</strong></span>}</header>
    <div className="journey-meter" role="progressbar" aria-label={`${completed} of ${steps.length} stages complete`}
      aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={completed}>
      <i style={{ width: `${progress}%` }} /></div>
    <ol className="journey-steps">{steps.map((step, index) => <li className={`is-${step.state}`} key={step.label}>
      <span className="journey-marker" aria-hidden="true">{step.state === 'complete' ? <Check size={15} strokeWidth={2.8} /> :
        step.state === 'upcoming' ? <LockKeyhole size={13} strokeWidth={2.3} /> : index + 1}</span>
      <div><strong>{step.label}</strong><small>{step.detail}</small></div></li>)}</ol>
  </section>;
}

export function SectionHeading({ id, title, description, aside }: Readonly<{
  id?: string; title: string; description?: string; aside?: ReactNode;
}>) {
  return <header className="dashboard-section-heading"><div><h2 id={id}>{title}</h2>{description && <p>{description}</p>}</div>
    {aside}</header>;
}

export function QuickActionTile({ icon: Icon, label, supporting = 'Coming next', href, onActivate, disabled = false }: Readonly<{
  icon: LucideIcon; label: string; supporting?: string; href?: string; onActivate?(): void; disabled?: boolean;
}>) {
  const content = <>
    <span className="quick-action-icon"><Icon size={19} /></span><span>{label}</span>
    <small>{supporting}</small><ArrowRight className="quick-action-arrow" size={17} />
  </>;
  if (href) return <Link className="quick-action-tile" href={href}>{content}</Link>;
  return <button className="quick-action-tile" onClick={onActivate} disabled={disabled}>{content}</button>;
}

export function ContentCard({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return <section className={cn('content-card', className)}>{children}</section>;
}
