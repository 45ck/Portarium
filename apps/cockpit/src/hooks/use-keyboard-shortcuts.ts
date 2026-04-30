import { useEffect, useRef } from 'react';
import { router } from '@/router';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { useCockpitExtensionContext } from '@/hooks/queries/use-cockpit-extension-context';
import { resolveCockpitExtensionServerAccess } from '@/lib/extensions/access-context';
import {
  INSTALLED_COCKPIT_EXTENSIONS,
  INSTALLED_COCKPIT_ROUTE_LOADERS,
} from '@/lib/extensions/installed';
import {
  resolveCockpitExtensionRegistry,
  selectExtensionCommands,
} from '@/lib/extensions/registry';
import type {
  CockpitExtensionAccessContext,
  ResolvedCockpitExtensionRegistry,
} from '@/lib/extensions/types';

const G_CHORD_MAP: Record<string, string> = {
  i: '/inbox',
  d: '/dashboard',
  w: '/work-items',
  r: '/runs',
  a: '/approvals',
  e: '/evidence',
};

const extensionRoutePaths: ReadonlyMap<string, string> = new Map(
  INSTALLED_COCKPIT_EXTENSIONS.flatMap((extension) => extension.routes).map((route) => [
    route.id,
    route.path,
  ]),
);

function resolveGChordMap(
  registry: ResolvedCockpitExtensionRegistry,
  accessContext: CockpitExtensionAccessContext,
): Record<string, string> {
  const activePersona = useUIStore.getState().activePersona;
  const extensionShortcuts = selectExtensionCommands(registry, activePersona, accessContext).reduce<
    Record<string, string>
  >((shortcuts, command) => {
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
  const activeWorkspaceId = useUIStore((state) => state.activeWorkspaceId);
  const activePersona = useUIStore((state) => state.activePersona);
  const claims = useAuthStore((state) => state.claims);
  const extensionContextQuery = useCockpitExtensionContext(activeWorkspaceId, claims?.sub);
  const extensionServerAccess = resolveCockpitExtensionServerAccess({
    workspaceId: activeWorkspaceId,
    principalId: claims?.sub,
    persona: activePersona,
    serverContext: extensionContextQuery.data,
  });
  const extensionRegistry = resolveCockpitExtensionRegistry({
    installedExtensions: INSTALLED_COCKPIT_EXTENSIONS,
    activePackIds: extensionServerAccess.activePackIds,
    quarantinedExtensionIds: extensionServerAccess.quarantinedExtensionIds,
    availableCapabilities: extensionServerAccess.accessContext.availableCapabilities,
    availableApiScopes: extensionServerAccess.accessContext.availableApiScopes,
    routeLoaders: INSTALLED_COCKPIT_ROUTE_LOADERS,
  });

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
        const route = resolveGChordMap(extensionRegistry, extensionServerAccess.accessContext)[
          e.key.toLowerCase()
        ];
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
  }, [extensionRegistry, extensionServerAccess.accessContext]);
}
