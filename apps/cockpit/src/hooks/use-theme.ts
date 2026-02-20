import { useState, useEffect } from 'react';

export type ThemeId = 'theme-arctic' | 'theme-midnight' | 'theme-warm' | 'theme-quantum';

const STORAGE_KEY = 'cockpit-theme';
const DEFAULT_THEME: ThemeId = 'theme-arctic';
export const ALL_THEMES: ThemeId[] = [
  'theme-arctic',
  'theme-midnight',
  'theme-warm',
  'theme-quantum',
];

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
      return stored && (ALL_THEMES as string[]).includes(stored) ? stored : DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    ALL_THEMES.forEach((t) => root.classList.remove(t));
    root.classList.add(theme);
  }, [theme]);

  const setTheme = (t: ThemeId) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {}
    setThemeState(t);
  };

  return { theme, setTheme, themes: ALL_THEMES };
}
