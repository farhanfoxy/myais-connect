'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const storageKey = 'myais-theme';
const changeEvent = 'myais-theme-change';
const systemQuery = '(prefers-color-scheme: dark)';
let volatilePreference: ThemePreference | null = null;

function storedPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  if (volatilePreference) return volatilePreference;
  try {
    const value = window.localStorage.getItem(storageKey);
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  } catch { return 'system'; }
}

function resolvedTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference;
  return typeof window !== 'undefined' && window.matchMedia(systemQuery).matches ? 'dark' : 'light';
}

function snapshot(): string {
  const preference = storedPreference();
  return `${preference}:${resolvedTheme(preference)}`;
}

function serverSnapshot(): string { return 'system:light'; }

function subscribe(listener: () => void) {
  const media = window.matchMedia(systemQuery);
  const notify = () => listener();
  media.addEventListener('change', notify);
  window.addEventListener('storage', notify);
  window.addEventListener(changeEvent, notify);
  return () => {
    media.removeEventListener('change', notify);
    window.removeEventListener('storage', notify);
    window.removeEventListener(changeEvent, notify);
  };
}

function applyTheme(preference: ThemePreference, resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference(preference: ThemePreference): void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system', resolvedTheme: 'light', setPreference: () => undefined,
});

export const themeInitializationScript = `(()=>{try{const k='${storageKey}',v=localStorage.getItem(k),p=v==='light'||v==='dark'||v==='system'?v:'system',d=p==='system'?(matchMedia('${systemQuery}').matches?'dark':'light'):p,r=document.documentElement;r.dataset.themePreference=p;r.dataset.theme=d;r.style.colorScheme=d}catch{}})()`;

export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const state = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [preferenceValue, resolvedValue] = state.split(':') as [ThemePreference, ResolvedTheme];
  useEffect(() => { applyTheme(preferenceValue, resolvedValue); }, [preferenceValue, resolvedValue]);
  const setPreference = useCallback((preference: ThemePreference) => {
    try { window.localStorage.setItem(storageKey, preference); volatilePreference = null; }
    catch { volatilePreference = preference; }
    applyTheme(preference, resolvedTheme(preference));
    window.dispatchEvent(new Event(changeEvent));
  }, []);
  const value = useMemo(() => ({ preference: preferenceValue, resolvedTheme: resolvedValue, setPreference }),
    [preferenceValue, resolvedValue, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }
