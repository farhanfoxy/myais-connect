import Link from 'next/link';
import { BadgeCheck, ShieldCheck, UsersRound } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';

const highlights = [
  { icon: ShieldCheck, title: 'Secure membership access', copy: 'Your account and membership journey, protected in one place.' },
  { icon: BadgeCheck, title: 'A clearer application journey', copy: 'Stay ready for every step from profile to active membership.' },
  { icon: UsersRound, title: 'Built for the IS community', copy: 'A trusted digital home for Malaysia’s information systems professionals.' },
];

export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}>) {
  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="About MyAIS Connect">
        <div className="auth-story-glow auth-story-glow-one" />
        <div className="auth-story-glow auth-story-glow-two" />
        <BrandMark inverse />
        <div className="auth-story-content">
          <p className="auth-kicker">Malaysian Association for Information Systems</p>
          <h1>A more connected professional community.</h1>
          <p className="auth-story-copy">Manage your MyAIS membership through a calm, secure and thoughtfully designed experience.</p>
          <div className="auth-highlights">
            {highlights.map(({ icon: Icon, title: itemTitle, copy }) => (
              <div className="auth-highlight" key={itemTitle}>
                <span><Icon size={19} strokeWidth={1.8} /></span>
                <div><strong>{itemTitle}</strong><p>{copy}</p></div>
              </div>
            ))}
          </div>
        </div>
        <p className="auth-story-footer">A professional platform for the MyAIS community.</p>
      </section>
      <section className="auth-form-panel">
        <div className="auth-mobile-brand"><BrandMark /></div>
        <div className="auth-form-wrap">
          <header className="auth-heading">
            <p>{eyebrow}</p>
            <h2>{title}</h2>
            <span>{description}</span>
          </header>
          <div className="auth-card">{children}</div>
          {footer && <div className="auth-footer">{footer}</div>}
          <p className="auth-legal">By continuing, you agree to use MyAIS Connect responsibly and in accordance with association policies.</p>
        </div>
        <Link className="auth-help" href="mailto:secretariat@myais.org.my">Need help?</Link>
      </section>
    </main>
  );
}
