// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MembershipCardVisual } from '@/components/membership/digital-membership-card';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeSwitcher } from '@/components/theme-switcher';

let systemDark = false;
const systemListeners = new Set<() => void>();

function setSystemDark(value: boolean) {
  systemDark = value;
  systemListeners.forEach(listener => listener());
}

beforeEach(() => {
  systemDark = false;
  systemListeners.clear();
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themePreference;
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({
    get matches() { return systemDark; }, media: '(prefers-color-scheme: dark)', onchange: null,
    addEventListener: (_type: string, listener: () => void) => systemListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => systemListeners.delete(listener),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })) });
});

afterEach(() => { cleanup(); window.localStorage.clear(); });

describe('MyAIS theme preferences', () => {
  it('selects Light and Dark accessibly and persists the preference', async () => {
    const user = userEvent.setup();
    const first = render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    await user.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('myais-theme')).toBe('dark');
    expect(screen.getByRole('menuitemradio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true');
    first.unmount();
    render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    expect(screen.getByRole('menuitemradio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('menuitemradio', { name: 'Light' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('myais-theme')).toBe('light');
    await user.click(screen.getByRole('menuitemradio', { name: 'System' }));
    expect(document.documentElement.dataset.themePreference).toBe('system');
    expect(window.localStorage.getItem('myais-theme')).toBe('system');
  });

  it('uses System by default and responds to an operating-system theme change', async () => {
    render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    await waitFor(() => expect(document.documentElement.dataset.themePreference).toBe('system'));
    expect(document.documentElement.dataset.theme).toBe('light');
    setSystemDark(true);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    setSystemDark(false);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
  });

  it('keeps the membership credential markup fixed when the surrounding theme changes', () => {
    const membership = { membershipNumber: 'MYAIS-2026-000001', membershipTypeCode: 'ORDINARY',
      membershipTypeName: 'Ordinary Member', status: 'ACTIVE', startDate: '2026-01-01', expiryDate: '2026-12-31',
      votingEligible: true, activatedAt: '2026-01-01T00:00:00.000Z' } as const;
    const view = render(<MembershipCardVisual membership={membership} profileName="Aisyah Rahman" gender="FEMALE"
      canonicalName="Aisyah Rahman" photoUrl={null} />);
    const lightMarkup = view.container.querySelector('.digital-card')?.innerHTML;
    document.documentElement.dataset.theme = 'dark';
    expect(view.container.querySelector('.digital-card')?.innerHTML).toBe(lightMarkup);
    expect(screen.getByText('MyAIS')).toBeTruthy();
    expect(screen.getByText('Connect')).toBeTruthy();
    expect(screen.getByText('Ms Aisyah Rahman')).toBeTruthy();
  });
});
