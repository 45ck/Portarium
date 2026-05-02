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
  principalId?: string;
  persona?: string;
  now?: Date;
}

export interface ResolvedCockpitExtensionServerAccess {
  activePackIds: readonly string[];
  quarantinedExtensionIds: readonly string[];
  emergencyDisabledExtensionIds: readonly string[];
  accessContext: CockpitExtensionAccessContext;
  usable: boolean;
}

const EMPTY_SERVER_ACCESS: ResolvedCockpitExtensionServerAccess = {
  activePackIds: [],
  quarantinedExtensionIds: [],
  emergencyDisabledExtensionIds: [],
  accessContext: {
    availablePersonas: [],
    availableCapabilities: [],
    availableApiScopes: [],
    availablePrivacyClasses: [],
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
    availablePrivacyClasses: fallback.availablePrivacyClasses,
  };
}

export function resolveCockpitExtensionServerAccess({
  serverContext,
  workspaceId,
  principalId,
  persona,
  now = new Date(),
}: ResolveCockpitExtensionServerAccessInput): ResolvedCockpitExtensionServerAccess {
  if (!serverContext) return EMPTY_SERVER_ACCESS;
  if (!isValidServerContext(serverContext)) return EMPTY_SERVER_ACCESS;
  if (serverContext.workspaceId !== workspaceId) return EMPTY_SERVER_ACCESS;
  if (principalId && serverContext.principalId !== principalId) return EMPTY_SERVER_ACCESS;
  if (isExpired(serverContext.expiresAtIso, now)) return EMPTY_SERVER_ACCESS;

  const resolvedPersona = persona ?? serverContext.persona;
  return {
    activePackIds: serverContext.activePackIds,
    quarantinedExtensionIds: serverContext.quarantinedExtensionIds,
    emergencyDisabledExtensionIds: serverContext.emergencyDisabledExtensionIds ?? [],
    accessContext: {
      ...(resolvedPersona ? { persona: resolvedPersona } : {}),
      availablePersonas: serverContext.availablePersonas,
      availableCapabilities: serverContext.availableCapabilities,
      availableApiScopes: serverContext.availableApiScopes,
      availablePrivacyClasses: serverContext.availablePrivacyClasses,
    },
    usable: true,
  };
}

function isValidServerContext(serverContext: CockpitExtensionContextResponse): boolean {
  return (
    serverContext.schemaVersion === 1 &&
    typeof serverContext.workspaceId === 'string' &&
    typeof serverContext.principalId === 'string' &&
    (serverContext.persona === undefined || typeof serverContext.persona === 'string') &&
    typeof serverContext.issuedAtIso === 'string' &&
    typeof serverContext.expiresAtIso === 'string' &&
    isStringArray(serverContext.availablePersonas) &&
    isStringArray(serverContext.availableCapabilities) &&
    isStringArray(serverContext.availableApiScopes) &&
    isStringArray(serverContext.availablePrivacyClasses) &&
    isStringArray(serverContext.activePackIds) &&
    isStringArray(serverContext.quarantinedExtensionIds) &&
    (serverContext.emergencyDisabledExtensionIds === undefined ||
      isStringArray(serverContext.emergencyDisabledExtensionIds))
  );
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isExpired(expiresAtIso: string, now: Date): boolean {
  const expiresAtMs = Date.parse(expiresAtIso);
  if (Number.isNaN(expiresAtMs)) return true;
  return expiresAtMs <= now.getTime();
}
