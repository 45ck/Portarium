import { useEffect, useRef } from 'react';
import { router } from '@/router';
import { useUIStore } from '@/stores/ui-store';

const G_CHORD_MAP: Record<string, string> = {
  i: '/inbox',
  d: '/dashboard',
  w: '/work-items',
  r: '/runs',
  a: '/approvals',
  e: '/evidence',
};

function isEditableTarget(e: Event): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.isContentEditable) return true;
  // Also skip if inside a cmdk input (command palette)
  if (el.closest('[cmdk-input]')) return true;
  return false;
}

export function useKeyboardShortcuts() {
  const gPressedRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e)) return;

      // "?" opens keyboard cheatsheet
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        useUIStore.getState().setKeyboardCheatsheetOpen(true);
        return;
      }

      // G-chord navigation
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!gPressedRef.current) {
          gPressedRef.current = true;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          gTimerRef.current = setTimeout(() => {
            gPressedRef.current = false;
          }, 1000);
          return;
        }
      }

      if (gPressedRef.current) {
        const route = G_CHORD_MAP[e.key];
        if (route) {
          e.preventDefault();
          router.navigate({ to: route as never });
        }
        gPressedRef.current = false;
        if (gTimerRef.current) {
          clearTimeout(gTimerRef.current);
          gTimerRef.current = null;
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
    };
  }, []);
}
