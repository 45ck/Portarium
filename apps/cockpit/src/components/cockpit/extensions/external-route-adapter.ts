import type { ComponentType } from 'react';
import { DEFAULT_COCKPIT_EXTENSION_REGISTRY } from '@/lib/extensions/installed';
import { canAccessExtensionRoute } from '@/lib/extensions/registry';
import type {
  CockpitExtensionAccessDenial,
  CockpitExtensionDisableReason,
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

export type ExternalRouteAuditReason =
  | 'route-allowed'
  | 'not-found'
  | 'registry-invalid'
  | 'extension-disabled'
  | 'extension-emergency-disabled'
  | 'extension-quarantined'
  | 'extension-invalid'
  | 'route-forbidden'
  | 'missing-renderer';

export interface ExternalRouteGuardAudit {
  decision: 'allow' | 'deny';
  reason: ExternalRouteAuditReason;
  surface: 'external-route';
  pathname: string;
  extensionId?: string;
  routeId?: string;
  matchedPath?: string;
  extensionStatus?: ResolvedCockpitExtension['status'];
  denials?: readonly CockpitExtensionAccessDenial[];
  disableReasons?: readonly CockpitExtensionDisableReason[];
}

export type ExternalRouteResolution =
  | {
      kind: 'active';
      route: CockpitExtensionRouteRef;
      extension: ResolvedCockpitExtension;
      params: Readonly<Record<string, string>>;
      component: ExternalRouteComponent;
      audit: ExternalRouteGuardAudit;
    }
  | {
      kind: 'forbidden';
      route: CockpitExtensionRouteRef;
      extension: ResolvedCockpitExtension;
      params: Readonly<Record<string, string>>;
      denials: readonly CockpitExtensionAccessDenial[];
      audit: ExternalRouteGuardAudit;
    }
  | {
      kind: 'not-found';
      pathname: string;
      audit: ExternalRouteGuardAudit;
    };

export interface ResolveExternalRouteInput {
  pathname: string;
  persona: PersonaId;
  availablePersonas?: readonly string[];
  availableCapabilities?: readonly string[];
  availableApiScopes?: readonly string[];
  availablePrivacyClasses?: readonly string[];
  registry?: ResolvedCockpitExtensionRegistry;
  components?: Readonly<Record<string, ExternalRouteComponent>>;
}

export const HOST_EXTERNAL_EXTENSION_REGISTRY = DEFAULT_COCKPIT_EXTENSION_REGISTRY;

export function resolveExternalRoute({
  pathname,
  persona,
  availablePersonas,
  availableCapabilities,
  availableApiScopes,
  availablePrivacyClasses,
  registry = HOST_EXTERNAL_EXTENSION_REGISTRY,
  components = {},
}: ResolveExternalRouteInput): ExternalRouteResolution {
  const normalizedPathname = normalizePath(pathname);

  if (registry.problems.length > 0) {
    return notFoundAudit(normalizedPathname, 'registry-invalid');
  }

  for (const extension of registry.extensions) {
    for (const route of extension.manifest.routes) {
      const params = matchExternalRoutePath(route.path, normalizedPathname);
      if (!params) continue;

      if (extension.status !== 'enabled') {
        return {
          kind: 'not-found',
          pathname: normalizedPathname,
          audit: buildAudit({
            decision: 'deny',
            reason: extensionStatusAuditReason(extension.status),
            pathname: normalizedPathname,
            extension,
            route,
          }),
        };
      }

      const decision = canAccessExtensionRoute(route, {
        persona,
        availablePersonas,
        availableCapabilities,
        availableApiScopes,
        availablePrivacyClasses,
      });
      if (!decision.allowed) {
        return {
          kind: 'forbidden',
          route,
          extension,
          params,
          denials: decision.denials,
          audit: buildAudit({
            decision: 'deny',
            reason: 'route-forbidden',
            pathname: normalizedPathname,
            extension,
            route,
            denials: decision.denials,
          }),
        };
      }

      const component = components[route.id];
      if (!component) {
        return {
          kind: 'not-found',
          pathname: normalizedPathname,
          audit: buildAudit({
            decision: 'deny',
            reason: 'missing-renderer',
            pathname: normalizedPathname,
            extension,
            route,
          }),
        };
      }

      return {
        kind: 'active',
        route,
        extension,
        params,
        component,
        audit: buildAudit({
          decision: 'allow',
          reason: 'route-allowed',
          pathname: normalizedPathname,
          extension,
          route,
        }),
      };
    }
  }

  return notFoundAudit(normalizedPathname, 'not-found');
}

function notFoundAudit(
  pathname: string,
  reason: ExternalRouteAuditReason,
): ExternalRouteResolution {
  return {
    kind: 'not-found',
    pathname,
    audit: buildAudit({
      decision: 'deny',
      reason,
      pathname,
    }),
  };
}

function extensionStatusAuditReason(
  status: ResolvedCockpitExtension['status'],
): ExternalRouteAuditReason {
  switch (status) {
    case 'quarantined':
      return 'extension-quarantined';
    case 'emergency-disabled':
      return 'extension-emergency-disabled';
    case 'invalid':
      return 'extension-invalid';
    case 'disabled':
    case 'enabled':
      return 'extension-disabled';
  }
}

function buildAudit({
  decision,
  reason,
  pathname,
  extension,
  route,
  denials,
}: {
  decision: ExternalRouteGuardAudit['decision'];
  reason: ExternalRouteAuditReason;
  pathname: string;
  extension?: ResolvedCockpitExtension;
  route?: CockpitExtensionRouteRef;
  denials?: readonly CockpitExtensionAccessDenial[];
}): ExternalRouteGuardAudit {
  return {
    decision,
    reason,
    surface: 'external-route',
    pathname,
    ...(extension
      ? {
          extensionId: extension.manifest.id,
          extensionStatus: extension.status,
          disableReasons: extension.disableReasons,
        }
      : {}),
    ...(route ? { routeId: route.id, matchedPath: route.path } : {}),
    ...(denials ? { denials } : {}),
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
      const decodedSegment = decodePathSegment(pathSegment);
      if (decodedSegment === null) return null;
      params[paramName] = decodedSegment;
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

function decodePathSegment(segment: string): string | null {
  try {
    const decoded = decodeURIComponent(segment);
    if (decoded === '.' || decoded === '..') return null;
    if (decoded.includes('/') || decoded.includes('\\')) return null;
    if (/[\u0000-\u001f\u007f]/.test(decoded)) return null;
    return decoded;
  } catch {
    return segment;
  }
}
