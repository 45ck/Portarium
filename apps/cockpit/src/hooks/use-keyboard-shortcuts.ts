import { useEffect, useRef } from 'react';
import { router } from '@/router';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { resolveCockpitExtensionAccessContext } from '@/lib/extensions/access-context';
import {
  DEFAULT_COCKPIT_EXTENSION_ACCESS_CONTEXT,
  DEFAULT_COCKPIT_EXTENSION_REGISTRY,
} from '@/lib/extensions/installed';
import { selectExtensionCommands } from '@/lib/extensions/registry';

const G_CHORD_MAP: Record<string, string> = {
  i: '/inbox',
  d: '/dashboard',
  w: '/work-items',
  r: '/runs',
  a: '/approvals',
  e: '/evidence',
};

const extensionRoutePaths = new Map(
  DEFAULT_COCKPIT_EXTENSION_REGISTRY.routes.map((route) => [route.id, route.path]),
);

function resolveGChordMap(): Record<string, string> {
  const activePersona = useUIStore.getState().activePersona;
  const claims = useAuthStore.getState().claims;
  const extensionAccessContext = resolveCockpitExtensionAccessContext({
    claims,
    persona: activePersona,
    fallback: DEFAULT_COCKPIT_EXTENSION_ACCESS_CONTEXT,
  });
  const extensionShortcuts = selectExtensionCommands(
    DEFAULT_COCKPIT_EXTENSION_REGISTRY,
    activePersona,
    extensionAccessContext,
  ).reduce<Record<string, string>>((shortcuts, command) => {
    const match = command.shortcut?.match(/^G\s+([a-z])$/i);
    const routePath = command.routeId ? extensionRoutePaths.get(command.routeId) : undefined;
    if (!match?.[1] || !routePath || routePath.includes('$')) return shortcuts;

    const key = match[1].toLowerCase();
    if (!G_CHORD_MAP[key]) {
      shortcuts[key] = routePath;
    }
    return shortcuts;
  }, {});

  return {
    ...G_CHORD_MAP,
    ...extensionShortcuts,
  };
}

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
        const route = resolveGChordMap()[e.key.toLowerCase()];
        if (route) {
          e.preventDefault();
          void router.navigate({ to: route as never });
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
