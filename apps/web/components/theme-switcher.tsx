'use client';

import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

const options: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeSwitcher({ mobile = false }: Readonly<{ mobile?: boolean }>) {
  const { preference, setPreference } = useTheme();
  return <section className={cn('theme-switcher', mobile && 'theme-switcher-mobile')} aria-label="Appearance">
    <div className="theme-switcher-heading"><span>Appearance</span><small>Interface theme</small></div>
    <div className="theme-options" role="group" aria-label="Theme preference">{options.map(option => {
      const Icon = option.icon; const selected = preference === option.value;
      return <button key={option.value} type="button" role="menuitemradio" aria-checked={selected}
        className={cn('theme-option', selected && 'is-selected')} onClick={() => setPreference(option.value)}>
        <Icon /><span>{option.label}</span>{selected && <Check className="theme-option-check" />}</button>;
    })}</div>
  </section>;
}
