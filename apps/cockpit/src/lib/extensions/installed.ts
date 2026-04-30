import { COCKPIT_EXTENSION_FIXTURES } from './fixtures';
import { resolveCockpitExtensionRegistry } from './registry';

export const INSTALLED_COCKPIT_EXTENSIONS = COCKPIT_EXTENSION_FIXTURES;

export const DEFAULT_ACTIVE_EXTENSION_PACK_IDS = ['example.ops-demo'] as const;

export const DEFAULT_COCKPIT_EXTENSION_REGISTRY = resolveCockpitExtensionRegistry({
  installedExtensions: INSTALLED_COCKPIT_EXTENSIONS,
  activePackIds: DEFAULT_ACTIVE_EXTENSION_PACK_IDS,
});
