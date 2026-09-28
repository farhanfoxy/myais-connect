import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
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
    <span className="welcome-brand" aria-hidden="true"><Image src="/brand/myais-connect-mark.png" width={1200}
      height={1200} sizes="74px" alt="" /></span></section>;
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
