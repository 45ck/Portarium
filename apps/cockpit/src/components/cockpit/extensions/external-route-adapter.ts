import type { ComponentType } from 'react';
import {
  DEFAULT_ACTIVE_EXTENSION_PACK_IDS,
  DEFAULT_COCKPIT_EXTENSION_ACCESS_CONTEXT,
  resolveInstalledCockpitExtensionRegistry,
} from '@/lib/extensions/installed';
import { canAccessExtensionRoute } from '@/lib/extensions/registry';
import type {
  CockpitExtensionRouteRef,
  ResolvedCockpitExtension,
  ResolvedCockpitExtensionRegistry,
} from '@/lib/extensions/types';
import type { PersonaId } from '@/stores/ui-store';

export interface ExternalRouteComponentProps {
  route: CockpitExtensionRouteRef;
  extension: ResolvedCockpitExtension;
  params: Readonly<Record<string, string>>;
}

export type ExternalRouteComponent = ComponentType<ExternalRouteComponentProps>;

export type ExternalRouteResolution =
  | {
      kind: 'active';
      route: CockpitExtensionRouteRef;
      extension: ResolvedCockpitExtension;
      params: Readonly<Record<string, string>>;
      component: ExternalRouteComponent | null;
    }
  | {
      kind: 'forbidden';
      route: CockpitExtensionRouteRef;
      extension: ResolvedCockpitExtension;
      params: Readonly<Record<string, string>>;
    }
  | {
      kind: 'not-found';
      pathname: string;
    };

export interface ResolveExternalRouteInput {
  pathname: string;
  persona: PersonaId;
  availablePersonas?: readonly string[];
  availableCapabilities?: readonly string[];
  availableApiScopes?: readonly string[];
  registry?: ResolvedCockpitExtensionRegistry;
  components?: Readonly<Record<string, ExternalRouteComponent>>;
}

export const HOST_EXTERNAL_EXTENSION_REGISTRY = resolveInstalledCockpitExtensionRegistry({
  activePackIds: DEFAULT_ACTIVE_EXTENSION_PACK_IDS,
  ...DEFAULT_COCKPIT_EXTENSION_ACCESS_CONTEXT,
});

export function resolveExternalRoute({
  pathname,
  persona,
  availablePersonas,
  availableCapabilities,
  availableApiScopes,
  registry = HOST_EXTERNAL_EXTENSION_REGISTRY,
  components = {},
}: ResolveExternalRouteInput): ExternalRouteResolution {
  const normalizedPathname = normalizePath(pathname);

  for (const extension of registry.extensions) {
    if (extension.status !== 'enabled') continue;

    for (const route of extension.manifest.routes) {
      const params = matchExternalRoutePath(route.path, normalizedPathname);
      if (!params) continue;

      if (
        !canAccessExtensionRoute(route, {
          persona,
          availablePersonas,
          availableCapabilities,
          availableApiScopes,
        }).allowed
      ) {
        return {
          kind: 'forbidden',
          route,
          extension,
          params,
        };
      }

      return {
        kind: 'active',
        route,
        extension,
        params,
        component: components[route.id] ?? null,
      };
    }
  }

  return {
    kind: 'not-found',
    pathname: normalizedPathname,
  };
}

function matchExternalRoutePath(
  routePath: string,
  pathname: string,
): Readonly<Record<string, string>> | null {
  const routeSegments = splitPath(routePath);
  const pathSegments = splitPath(pathname);

  if (routeSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};

  for (let index = 0; index < routeSegments.length; index += 1) {
    const routeSegment = routeSegments[index];
    const pathSegment = pathSegments[index];

    if (!routeSegment || !pathSegment) return null;

    if (routeSegment.startsWith('$')) {
      const paramName = routeSegment.slice(1);
      if (!paramName) return null;
      params[paramName] = decodePathSegment(pathSegment);
      continue;
    }

    if (routeSegment !== pathSegment) return null;
  }

  return params;
}

function normalizePath(pathname: string): string {
  const [withoutQuery = '/'] = pathname.split(/[?#]/, 1);
  if (withoutQuery === '/') return withoutQuery;
  return withoutQuery.replace(/\/+$/, '');
}

function splitPath(pathname: string): string[] {
  return normalizePath(pathname).split('/').filter(Boolean);
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
