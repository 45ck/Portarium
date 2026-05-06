import {
  INSTALLED_COCKPIT_ROUTE_HOST_ACCESS_CONTEXT,
  INSTALLED_COCKPIT_ROUTE_HOST_PACK_IDS,
  resolveInstalledCockpitExtensionRegistry,
  type ResolveInstalledCockpitExtensionRegistryInput,
} from '@/lib/extensions/installed';
import { resolveCockpitShellProfile, type CockpitShellProfile } from './navigation';

const EMPTY_EXTENSION_ACCESS: ResolveInstalledCockpitExtensionRegistryInput = {
  activePackIds: INSTALLED_COCKPIT_ROUTE_HOST_PACK_IDS,
  availablePersonas: [],
  availableCapabilities: INSTALLED_COCKPIT_ROUTE_HOST_ACCESS_CONTEXT.availableCapabilities,
  availableApiScopes: INSTALLED_COCKPIT_ROUTE_HOST_ACCESS_CONTEXT.availableApiScopes,
  availablePrivacyClasses: INSTALLED_COCKPIT_ROUTE_HOST_ACCESS_CONTEXT.availablePrivacyClasses,
};

export function resolveActiveCockpitShellProfile(
  modeId = import.meta.env.VITE_COCKPIT_SHELL_MODE,
): CockpitShellProfile {
  const registry = resolveInstalledCockpitExtensionRegistry(EMPTY_EXTENSION_ACCESS);
  return resolveCockpitShellProfile(registry, modeId);
}

export function resolveActiveCockpitShellDefaultRoutePath(
  modeId = import.meta.env.VITE_COCKPIT_SHELL_MODE,
): string | undefined {
  return resolveActiveCockpitShellProfile(modeId).defaultRoutePath;
}
