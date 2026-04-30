import type { CockpitExtensionContextResponse } from '@portarium/cockpit-types';
import type { ParsedAuthClaims } from '@/stores/auth-store';
import type { CockpitExtensionAccessContext } from './types';

export interface ResolveCockpitExtensionAccessContextInput {
  claims: ParsedAuthClaims | null;
  persona: string;
  fallback: Omit<CockpitExtensionAccessContext, 'persona'>;
}

export interface ResolveCockpitExtensionServerAccessInput {
  serverContext: CockpitExtensionContextResponse | null | undefined;
  workspaceId: string;
  persona?: string;
  now?: Date;
}

export interface ResolvedCockpitExtensionServerAccess {
  activePackIds: readonly string[];
  accessContext: CockpitExtensionAccessContext;
  usable: boolean;
}

const EMPTY_SERVER_ACCESS: ResolvedCockpitExtensionServerAccess = {
  activePackIds: [],
  accessContext: {
    availablePersonas: [],
    availableCapabilities: [],
    availableApiScopes: [],
  },
  usable: false,
};

export function resolveCockpitExtensionAccessContext({
  claims,
  persona,
  fallback,
}: ResolveCockpitExtensionAccessContextInput): CockpitExtensionAccessContext {
  if (!claims) {
    return {
      persona,
      ...fallback,
    };
  }

  return {
    persona,
    availablePersonas: claims.personas,
    availableCapabilities: claims.capabilities,
    availableApiScopes: claims.apiScopes,
  };
}

export function resolveCockpitExtensionServerAccess({
  serverContext,
  workspaceId,
  persona,
  now = new Date(),
}: ResolveCockpitExtensionServerAccessInput): ResolvedCockpitExtensionServerAccess {
  if (!serverContext) return EMPTY_SERVER_ACCESS;
  if (serverContext.workspaceId !== workspaceId) return EMPTY_SERVER_ACCESS;
  if (isExpired(serverContext.expiresAtIso, now)) return EMPTY_SERVER_ACCESS;

  const resolvedPersona = persona ?? serverContext.persona;
  return {
    activePackIds: serverContext.activePackIds,
    accessContext: {
      ...(resolvedPersona ? { persona: resolvedPersona } : {}),
      availablePersonas: serverContext.availablePersonas,
      availableCapabilities: serverContext.availableCapabilities,
      availableApiScopes: serverContext.availableApiScopes,
    },
    usable: true,
  };
}

function isExpired(expiresAtIso: string, now: Date): boolean {
  const expiresAtMs = Date.parse(expiresAtIso);
  if (Number.isNaN(expiresAtMs)) return true;
  return expiresAtMs <= now.getTime();
}
