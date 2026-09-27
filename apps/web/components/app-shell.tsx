'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  CalendarDays,
  ChevronRight,
  CreditCard,
  FileClock,
  FileText,
  House,
  IdCard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { humanizeEnum, roleFamily } from '@/lib/roles';
import { cn } from '@/lib/utils';

const memberItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', enabled: true },
  { label: 'Profile', icon: UserRound, enabled: false },
  { label: 'My Application', icon: FileText, enabled: false },
  { label: 'Application Tracker', icon: FileClock, enabled: false },
  { label: 'Payment', icon: CreditCard, enabled: false },
  { label: 'Membership Card', icon: IdCard, enabled: false },
  { label: 'Notifications', icon: Bell, enabled: false },
  { label: 'Announcements', icon: Megaphone, enabled: false },
  { label: 'Events', icon: CalendarDays, enabled: false },
] as const;

const adminItems = [
  { label: 'Admin overview', icon: ShieldCheck, href: '/admin', enabled: true },
  { label: 'Review workspace', icon: FileText, enabled: false },
  { label: 'Payment review', icon: CreditCard, enabled: false },
] as const;

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  if (state.status !== 'authenticated') return null;
  const user = state.user;
  const isCommittee = roleFamily(user.role) === 'committee';
  const items = isCommittee ? adminItems : memberItems;
  const title = isCommittee ? 'Administration' : 'Dashboard';
  const initial = (user.fullName ?? user.email).trim().charAt(0).toUpperCase();

  async function signOut() {
    await logout();
    router.replace('/login');
  }

  const navigation = (
    <>
      <p className="nav-section-label">Workspace</p>
      <nav className="shell-nav" aria-label="Primary navigation">
        {items.map(item => item.enabled ? (
          <Link key={item.label} href={item.href} onClick={() => setDrawerOpen(false)}
            className={cn('shell-nav-item', pathname === item.href && 'is-active')}>
            <item.icon size={19} strokeWidth={1.8} />
            <span>{item.label}</span>
            {pathname === item.href && <span className="nav-active-dot" />}
          </Link>
        ) : (
          <button key={item.label} className="shell-nav-item is-disabled" disabled>
            <item.icon size={19} strokeWidth={1.8} /><span>{item.label}</span><small>Soon</small>
          </button>
        ))}
      </nav>
    </>
  );

  return (
    <div className="app-frame">
      <aside className="desktop-sidebar">
        <div className="sidebar-brand"><BrandMark inverse /></div>
        <div className="sidebar-body">{navigation}</div>
        <div className="sidebar-user">
          <span className="user-avatar">{initial}</span>
          <div><strong>{user.fullName ?? user.email}</strong><span>{humanizeEnum(user.role)}</span></div>
          <button aria-label="Sign out" title="Sign out" onClick={() => void signOut()}><LogOut size={18} /></button>
        </div>
      </aside>

      <div className="app-workspace">
        <header className="app-header">
          <div className="mobile-header-brand"><BrandMark compact /><span>MyAIS Connect</span></div>
          <div className="app-header-title"><p>{isCommittee ? 'Committee workspace' : 'Member workspace'}</p><h1>{title}</h1></div>
          <div className="app-header-actions">
            <span className="status-pill"><span /> Active account</span>
            <div className="header-user"><span className="user-avatar user-avatar-light">{initial}</span>
              <div><strong>{user.fullName ?? 'MyAIS member'}</strong><span>{user.email}</span></div></div>
            <button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setDrawerOpen(true)}><Menu /></button>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <Link className={cn(pathname === (isCommittee ? '/admin' : '/dashboard') && 'is-active')}
          href={isCommittee ? '/admin' : '/dashboard'}><House /><span>Home</span></Link>
        <button onClick={() => setDrawerOpen(true)}><Menu /><span>Menu</span></button>
        <button onClick={() => void signOut()}><LogOut /><span>Sign out</span></button>
      </nav>

      {drawerOpen && (
        <div className="drawer-backdrop" role="presentation" onMouseDown={event => {
          if (event.currentTarget === event.target) setDrawerOpen(false);
        }}>
          <aside className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <div className="drawer-header"><BrandMark /><button aria-label="Close navigation" onClick={() => setDrawerOpen(false)}><X /></button></div>
            <div className="drawer-identity"><span className="user-avatar user-avatar-light">{initial}</span>
              <div><strong>{user.fullName ?? user.email}</strong><span>{humanizeEnum(user.role)}</span></div></div>
            <div className="drawer-navigation">{navigation}</div>
            <Button variant="secondary" className="button-full drawer-signout" onClick={() => void signOut()}>
              <LogOut size={18} /> Sign out <ChevronRight size={17} />
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}
