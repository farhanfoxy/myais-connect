// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '@/components/app-shell';

const fixture = vi.hoisted(() => ({
  pathname: '/dashboard',
  replace: vi.fn(),
  logout: vi.fn(async () => {}),
  state: {
    status: 'authenticated' as const,
    user: {
      id: 'user-1', email: 'member@example.test', fullName: 'Aisyah Rahman', photoUrl: null,
      role: 'APPLICANT', accountStatus: 'ACTIVE',
    },
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => fixture.pathname,
  useRouter: () => ({ replace: fixture.replace }),
}));

vi.mock('@/components/auth/auth-provider', () => ({
  useAuth: () => ({ state: fixture.state, logout: fixture.logout }),
}));

afterEach(cleanup);
beforeEach(() => {
  fixture.pathname = '/dashboard';
  fixture.replace.mockReset();
  fixture.logout.mockClear();
});

describe('responsive application shell interactions', () => {
  it('opens the membership menu and restores trigger focus when Escape closes it', async () => {
    const user = userEvent.setup();
    render(<AppShell><p>Protected content</p></AppShell>);
    const trigger = screen.getByRole('button', { name: /Membership/ });
    await user.click(trigger);
    expect(screen.getByRole('menu', { name: 'Membership navigation' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu', { name: 'Membership navigation' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('provides feedback for unfinished navigation without pretending the route exists', async () => {
    const user = userEvent.setup();
    render(<AppShell><p>Protected content</p></AppShell>);
    await user.click(screen.getByRole('button', { name: 'Events' }));
    expect(screen.getByRole('status').textContent).toContain('Events is coming in a future MyAIS phase.');
  });

  it('supports an accessible mobile drawer with Escape and focus restoration', async () => {
    const user = userEvent.setup();
    render(<AppShell><p>Protected content</p></AppShell>);
    const trigger = screen.getByRole('button', { name: 'Open navigation menu' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'MyAIS navigation menu' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'MyAIS navigation menu' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps logout in the account menu and returns to login', async () => {
    const user = userEvent.setup();
    render(<AppShell><p>Protected content</p></AppShell>);
    await user.click(screen.getByRole('button', { name: 'Open account menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(fixture.logout).toHaveBeenCalledOnce();
    expect(fixture.replace).toHaveBeenCalledWith('/login');
  });

  it('exposes Profile as a functional active membership route', async () => {
    fixture.pathname = '/profile';
    const user = userEvent.setup();
    render(<AppShell><p>Profile content</p></AppShell>);
    const membership = screen.getByRole('button', { name: /Membership/ });
    expect(membership.className).toContain('is-active');
    await user.click(membership);
    expect(screen.getByRole('menuitem', { name: 'Profile' }).getAttribute('href')).toBe('/profile');
    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('link', { name: 'Profile' }).className).toContain('is-active');
  });

  it('keeps the application route usable in desktop, drawer and mobile navigation', async () => {
    fixture.pathname = '/my-application';
    const user = userEvent.setup();
    render(<AppShell><p>Application content</p></AppShell>);
    expect(screen.getByRole('link', { name: 'Application' }).className).toContain('is-active');
    await user.click(screen.getByRole('button', { name: /Membership/ }));
    expect(screen.getByRole('menuitem', { name: 'My application' }).getAttribute('href')).toBe('/my-application');
    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('link', { name: 'My application' }).className).toContain('is-active');
  });

  it('enables the tracker while payment and membership card remain deferred', async () => {
    fixture.pathname = '/my-application/tracker';
    const user = userEvent.setup();
    render(<AppShell><p>Tracker content</p></AppShell>);
    expect(screen.getByRole('link', { name: 'Application' }).className).toContain('is-active');
    await user.click(screen.getByRole('button', { name: /Membership/ }));
    expect(screen.getByRole('menuitem', { name: 'Application tracker' }).getAttribute('href'))
      .toBe('/my-application/tracker');
    expect(screen.getByRole('menuitem', { name: /Payment.*Soon/ }).getAttribute('href')).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Membership card.*Soon/ }).getAttribute('href')).toBeNull();
  });
});
