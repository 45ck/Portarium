import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACTIVE_EXTENSION_PACK_IDS,
  DEFAULT_COCKPIT_EXTENSION_ACCESS_CONTEXT,
  INSTALLED_COCKPIT_EXTENSION_MODULES,
  INSTALLED_COCKPIT_ROUTE_PATHS,
  resolveInstalledCockpitExtensionRegistry,
} from './installed';

describe('installed cockpit extension catalog', () => {
  it('resolves the authoritative compile-time installed catalog', () => {
    const registry = resolveInstalledCockpitExtensionRegistry({
      activePackIds: DEFAULT_ACTIVE_EXTENSION_PACK_IDS,
      ...DEFAULT_COCKPIT_EXTENSION_ACCESS_CONTEXT,
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions.map((extension) => extension.status)).toEqual(['enabled']);
    expect(registry.routes.map((route) => route.id)).toEqual([
      'example-reference-overview',
      'example-reference-review',
    ]);
  });

  it('keeps installed route paths aligned with installed manifest routes', () => {
    for (const extension of INSTALLED_COCKPIT_EXTENSION_MODULES) {
      for (const route of extension.manifest.routes) {
        expect(INSTALLED_COCKPIT_ROUTE_PATHS.get(route.id)).toBe(route.path);
      }
    }
  });
});
