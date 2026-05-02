import { useAuthStore } from '@/stores/auth-store';
import { useCockpitExtensionContext } from '@/hooks/queries/use-cockpit-extension-context';
import { resolveCockpitExtensionServerAccess } from '@/lib/extensions/access-context';
import { resolveInstalledCockpitExtensionRegistry } from '@/lib/extensions/installed';
import type { ResolvedCockpitExtensionRegistry } from '@/lib/extensions/types';
import type { ResolvedCockpitExtensionServerAccess } from '@/lib/extensions/access-context';
import type { PersonaId } from '@/stores/ui-store';

export interface UseCockpitExtensionRegistryInput {
  workspaceId: string;
  persona: PersonaId;
  enabled?: boolean;
}

export interface UseCockpitExtensionRegistryResult {
  registry: ResolvedCockpitExtensionRegistry;
  serverAccess: ResolvedCockpitExtensionServerAccess;
}

export function useCockpitExtensionRegistry({
  workspaceId,
  persona,
  enabled = true,
}: UseCockpitExtensionRegistryInput): UseCockpitExtensionRegistryResult {
  const principalId = useAuthStore((state) => state.claims?.sub);
  const extensionContextQuery = useCockpitExtensionContext(enabled ? workspaceId : '', principalId);
  const serverAccess = resolveCockpitExtensionServerAccess({
    workspaceId,
    principalId,
    persona,
    serverContext:
      enabled && extensionContextQuery.isSuccess && !extensionContextQuery.isFetching
        ? extensionContextQuery.data
        : null,
  });
  const registry = resolveInstalledCockpitExtensionRegistry({
    activePackIds: serverAccess.activePackIds,
    quarantinedExtensionIds: serverAccess.quarantinedExtensionIds,
    emergencyDisabledExtensionIds: serverAccess.emergencyDisabledExtensionIds,
    availableCapabilities: serverAccess.accessContext.availableCapabilities,
    availableApiScopes: serverAccess.accessContext.availableApiScopes,
    availablePrivacyClasses: serverAccess.accessContext.availablePrivacyClasses,
  });

  return { registry, serverAccess };
}
