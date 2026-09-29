'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell, CalendarDays, ChevronDown, CreditCard, FileClock, FileText, House, IdCard,
  LayoutDashboard, LogOut, Megaphone, Menu, ShieldCheck, UserRound, X,
} from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { useAuth } from '@/components/auth/auth-provider';
import { humanizeEnum, roleFamily } from '@/lib/roles';
import { cn } from '@/lib/utils';

interface MenuItem { label: string; icon: typeof UserRound; href?: string }

const membershipItems: MenuItem[] = [
  { label: 'Profile', icon: UserRound, href: '/profile' },
  { label: 'My application', icon: FileText, href: '/my-application' },
  { label: 'Application tracker', icon: FileClock, href: '/my-application/tracker' },
  { label: 'Payment', icon: CreditCard, href: '/my-application/payment' },
  { label: 'Membership card', icon: IdCard, href: '/my-card' },
];
const memberDrawerItems: MenuItem[] = [...membershipItems,
  { label: 'Events', icon: CalendarDays }, { label: 'Announcements', icon: Megaphone }];
const committeeItems: MenuItem[] = [
  { label: 'Review workspace', icon: FileText }, { label: 'Payment review', icon: CreditCard },
];

function useDismissibleMenu(open: boolean, close: () => void,
  triggerRef: RefObject<HTMLButtonElement | null>, panelRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) close();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', keyboard);
    queueMicrotask(() => panelRef.current?.focus());
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', keyboard);
    };
  }, [close, open, panelRef, triggerRef]);
}

function ComingSoonItems({ items, announce, close }: Readonly<{
  items: MenuItem[]; announce(label: string): void; close(): void;
}>) {
  return items.map(({ label, icon: Icon, href }) => href ? <Link className="menu-option" href={href} key={label}
    role="menuitem" onClick={close}><span className="menu-option-icon"><Icon size={17} /></span><span>{label}</span></Link> :
    <button className="menu-option" key={label} role="menuitem" onClick={() => announce(label)}>
      <span className="menu-option-icon"><Icon size={17} /></span><span>{label}</span><small>Soon</small></button>);
}

function MembershipMenu({ announce, active }: Readonly<{ announce(label: string): void; active: boolean }>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useDismissibleMenu(open, close, triggerRef, panelRef);
  return <div className="top-nav-menu">
    <button ref={triggerRef} className={cn('top-nav-link top-nav-trigger', open && 'is-open', active && 'is-active')}
      aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      Membership <ChevronDown size={15} /></button>
    {open && <div ref={panelRef} className="nav-popover membership-popover" role="menu" tabIndex={-1}
      aria-label="Membership navigation"><div className="popover-heading"><span>Membership</span>
        <small>Member tools</small></div><ComingSoonItems items={membershipItems} close={close}
        announce={label => { close(); announce(label); }} /></div>}
  </div>;
}

function UserMenu({ name, email, role, initial, signOut }: Readonly<{
  name: string; email: string; role: string; initial: string; signOut(): Promise<void>;
}>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useDismissibleMenu(open, close, triggerRef, panelRef);
  return <div className="top-nav-menu user-menu-wrap">
    <div className={cn('user-menu-trigger', open && 'is-open')}>
      <Link className="user-profile-link" href="/profile" aria-label={`View ${name}'s profile`}>
        <span className="user-avatar">{initial}</span><span className="user-menu-name">{name}</span></Link>
      <button ref={triggerRef} className="account-menu-button" aria-label="Open account menu"
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <ChevronDown size={15} /></button></div>
    {open && <div ref={panelRef} className="nav-popover user-popover" role="menu" tabIndex={-1}
      aria-label="Account menu"><div className="user-popover-identity"><span className="user-avatar user-avatar-large">
        {initial}</span><div><strong>{name}</strong><span>{email}</span></div></div>
      <div className="user-popover-role"><ShieldCheck size={16} /><span>Canonical role</span><strong>{role}</strong></div>
      <button className="menu-option signout-option" role="menuitem" onClick={() => void signOut()}>
        <span className="menu-option-icon"><LogOut size={17} /></span><span>Sign out</span></button></div>}
  </div>;
}

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setDrawerOpen(false);
      drawerTriggerRef.current?.focus();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', keyboard);
    queueMicrotask(() => closeButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keyboard);
    };
  }, [drawerOpen]);

  if (state.status !== 'authenticated') return null;
  const user = state.user;
  const isCommittee = roleFamily(user.role) === 'committee';
  const home = isCommittee ? '/admin' : '/dashboard';
  const displayName = user.fullName?.trim() || user.email;
  const initial = displayName.charAt(0).toUpperCase();
  const role = humanizeEnum(user.role);
  const drawerItems = isCommittee ? committeeItems : memberDrawerItems;

  async function signOut() { await logout(); router.replace('/login'); }
  function announce(label: string) { setNotice(`${label} is coming in a future MyAIS phase.`); }
  function openDrawer(trigger: HTMLButtonElement) { drawerTriggerRef.current = trigger; setDrawerOpen(true); }
  function closeDrawer() { setDrawerOpen(false); drawerTriggerRef.current?.focus(); }

  return <div className="app-frame">
    <header className="product-header"><div className="product-header-inner">
      <Link className="header-brand" href={home} aria-label="MyAIS Connect home"><BrandMark /></Link>
      <nav className="desktop-top-nav" aria-label="Primary navigation">
        <Link className={cn('top-nav-link', pathname === home && 'is-active')} href={home}>
          {isCommittee ? 'Overview' : 'Dashboard'}</Link>
        {isCommittee ? <button className="top-nav-link" onClick={() => announce('Review workspace')}>Reviews</button> :
          <MembershipMenu announce={announce} active={pathname === '/profile' || pathname === '/my-card' || pathname.startsWith('/my-application')} />}
        <button className="top-nav-link" onClick={() => announce('Events')}>Events</button>
        <button className="top-nav-link" onClick={() => announce('Announcements')}>News</button>
      </nav>
      <div className="header-tools"><button className="header-icon-button" aria-label="Notifications"
        title="Notifications" onClick={() => announce('Notifications')}><Bell size={19} /></button>
        <UserMenu name={displayName} email={user.email} role={role} initial={initial} signOut={signOut} />
        <Link className="mobile-account-button" href="/profile" aria-label="View profile">
          <span className="user-avatar">{initial}</span></Link>
        <button className="mobile-menu-button" aria-label="Open navigation menu"
          onClick={event => openDrawer(event.currentTarget)}><Menu size={20} /></button></div>
    </div></header>

    <main className="app-content">{children}</main>

    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      <Link className={cn(pathname === home && 'is-active')} href={home}><House /><span>Dashboard</span></Link>
      <Link className={cn(pathname.startsWith('/my-application') && 'is-active')} href="/my-application">
        <FileText /><span>Application</span></Link>
      <Link className={cn(pathname === '/my-card' && 'is-active')} href="/my-card"><IdCard /><span>Card</span></Link>
      <button onClick={event => openDrawer(event.currentTarget)}><Menu /><span>More</span></button>
    </nav>

    {notice && <div className="shell-notice" role="status"><span>{notice}</span>
      <button aria-label="Dismiss message" onClick={() => setNotice('')}><X size={15} /></button></div>}

    {drawerOpen && <div className="drawer-backdrop" onPointerDown={event => {
      if (event.currentTarget === event.target) closeDrawer();
    }}><aside className="mobile-drawer" role="dialog" aria-modal="true" aria-label="MyAIS navigation menu">
      <div className="drawer-header"><BrandMark /><button ref={closeButtonRef} aria-label="Close navigation"
        onClick={closeDrawer}><X /></button></div>
      <Link className="drawer-identity" href="/profile" onClick={closeDrawer} aria-label="View profile">
        <span className="user-avatar user-avatar-large">{initial}</span>
        <div><strong>{displayName}</strong><span>{role}</span></div></Link>
      <nav className="drawer-navigation" aria-label="More navigation"><p>Workspace</p>
        <Link className={cn('drawer-link', pathname === home && 'is-active')} href={home} onClick={closeDrawer}>
          <LayoutDashboard size={19} /><span>{isCommittee ? 'Admin overview' : 'Dashboard'}</span></Link>
        {drawerItems.map(({ label, icon: Icon, href }) => href ? <Link className={cn('drawer-link', pathname === href && 'is-active')}
          key={label} href={href} onClick={closeDrawer}><Icon size={19} /><span>{label}</span></Link> :
          <button className="drawer-link" key={label} onClick={() => { announce(label); closeDrawer(); }}>
            <Icon size={19} /><span>{label}</span><small>Soon</small></button>)}
      </nav><button className="drawer-signout" onClick={() => void signOut()}><LogOut size={18} />Sign out</button>
    </aside></div>}
  </div>;
}
