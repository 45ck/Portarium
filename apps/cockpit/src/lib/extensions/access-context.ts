import type { ParsedAuthClaims } from '@/stores/auth-store';
import type { CockpitExtensionAccessContext } from './types';

export interface ResolveCockpitExtensionAccessContextInput {
  claims: ParsedAuthClaims | null;
  persona: string;
  fallback: Omit<CockpitExtensionAccessContext, 'persona'>;
}

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
