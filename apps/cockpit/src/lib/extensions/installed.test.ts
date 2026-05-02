import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ACTIVE_EXTENSION_PACK_IDS,
  DEFAULT_COCKPIT_EXTENSION_ACCESS_CONTEXT,
  INSTALLED_COCKPIT_EXTENSION_CATALOG_PROBLEMS,
  INSTALLED_COCKPIT_EXTENSION_MODULES,
  INSTALLED_COCKPIT_ROUTE_HOST_PACK_IDS,
  INSTALLED_COCKPIT_ROUTE_HOST_DEFINITIONS,
  INSTALLED_COCKPIT_ROUTE_HOST_PROBLEMS,
  INSTALLED_COCKPIT_ROUTE_LOADERS,
  INSTALLED_COCKPIT_ROUTE_PATHS,
  validateInstalledCockpitExtensionModules,
  resolveInstalledCockpitExtensionRegistry,
} from './installed';
import type { CockpitInstalledExtension } from './types';

describe('installed cockpit extension catalog', () => {
  it('keeps the authoritative compile-time installed catalog hidden without workspace activation', () => {
    const registry = resolveInstalledCockpitExtensionRegistry({
      activePackIds: DEFAULT_ACTIVE_EXTENSION_PACK_IDS,
      ...DEFAULT_COCKPIT_EXTENSION_ACCESS_CONTEXT,
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions.map((extension) => extension.status)).toEqual(['disabled']);
    expect(registry.extensions[0]?.disableReasons).toEqual([
      expect.objectContaining({ code: 'workspace-pack-inactive' }),
    ]);
    expect(registry.routes).toEqual([]);
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('resolves enabled installed extensions only from workspace activation state', () => {
    const registry = resolveInstalledCockpitExtensionRegistry({
      activePackIds: ['example.reference'],
      availableCapabilities: ['extension:read', 'extension:inspect'],
      availableApiScopes: ['extensions.read', 'extensions.inspect'],
      availablePrivacyClasses: ['internal', 'restricted'],
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions.map((extension) => extension.status)).toEqual(['enabled']);
    expect(registry.routes.map((route) => route.id)).toEqual([
      'example-reference-overview',
      'example-reference-detail',
    ]);
  });

  it('keeps installed route paths aligned with installed manifest routes', () => {
    expect(INSTALLED_COCKPIT_EXTENSION_CATALOG_PROBLEMS).toEqual([]);

    for (const extension of INSTALLED_COCKPIT_EXTENSION_MODULES) {
      for (const route of extension.manifest.routes) {
        expect(INSTALLED_COCKPIT_ROUTE_PATHS.get(route.id)).toBe(route.path);
      }
    }
  });

  it('keeps installed route modules in exact lockstep with manifest route ids', () => {
    const manifestRouteIds = INSTALLED_COCKPIT_EXTENSION_MODULES.flatMap((extension) =>
      extension.manifest.routes.map((route) => route.id),
    ).sort();
    const moduleRouteIds = INSTALLED_COCKPIT_EXTENSION_MODULES.flatMap((extension) =>
      extension.routeModules.map((routeModule) => routeModule.routeId),
    ).sort();

    expect(Object.keys(INSTALLED_COCKPIT_ROUTE_LOADERS).sort()).toEqual(manifestRouteIds);
    expect(moduleRouteIds).toEqual(manifestRouteIds);
  });

  it('requires host-reviewed package refs and workspace pack refs for installed modules', () => {
    for (const extension of INSTALLED_COCKPIT_EXTENSION_MODULES) {
      expect(extension.packageRef.packageName).toMatch(/^@portarium\/cockpit-/);
      expect(extension.workspacePackRefs.map((ref) => ref.packId).sort()).toEqual(
        [...extension.manifest.packIds].sort(),
      );
    }
  });

  it('reports install catalog mismatches before route chunks can be hosted', () => {
    const [installedExtension] = INSTALLED_COCKPIT_EXTENSION_MODULES;
    if (!installedExtension) throw new Error('Expected an installed extension fixture.');

    const invalid = {
      ...installedExtension,
      packageRef: { packageName: '' },
      workspacePackRefs: [{ packId: 'wrong.pack' }],
      routeModules: [
        installedExtension.routeModules[0]!,
        installedExtension.routeModules[0]!,
        { routeId: 'undeclared-route', loadModule: () => Promise.resolve({}) },
      ],
    } satisfies CockpitInstalledExtension;

    expect(validateInstalledCockpitExtensionModules([invalid])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing-package-ref' }),
        expect.objectContaining({ code: 'install-pack-ref-mismatch', itemId: 'example.reference' }),
        expect.objectContaining({ code: 'install-pack-ref-mismatch', itemId: 'wrong.pack' }),
        expect.objectContaining({ code: 'duplicate-route-module' }),
        expect.objectContaining({ code: 'missing-route-module' }),
        expect.objectContaining({ code: 'undeclared-route-module', itemId: 'undeclared-route' }),
      ]),
    );
  });

  it('marks installed catalog mismatches as invalid effective registry state', async () => {
    vi.resetModules();
    vi.doMock('./example-reference/route-loaders', () => ({
      EXAMPLE_REFERENCE_ROUTE_LOADERS: {
        'example-reference-overview': () => Promise.resolve({}),
      },
    }));

    const installed = await import('./installed');
    const registry = installed.resolveInstalledCockpitExtensionRegistry({
      activePackIds: ['example.reference'],
      availableCapabilities: ['extension:read', 'extension:inspect'],
      availableApiScopes: ['extensions.read', 'extensions.inspect'],
      availablePrivacyClasses: ['internal', 'restricted'],
    });

    expect(installed.INSTALLED_COCKPIT_EXTENSION_CATALOG_PROBLEMS).toEqual([
      expect.objectContaining({
        code: 'missing-route-module',
        extensionId: 'example.reference',
        itemId: 'example-reference-detail',
      }),
    ]);
    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.extensions[0]?.problems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing-route-module',
          itemId: 'example-reference-detail',
        }),
      ]),
    );
    expect(registry.routes).toEqual([]);

    vi.doUnmock('./example-reference/route-loaders');
    vi.resetModules();
  });

  it('keeps installed manifests data-only without remote executable entry fields', () => {
    const forbiddenKeys = new Set([
      'entry',
      'entrypoint',
      'script',
      'scripts',
      'module',
      'moduleUrl',
      'remoteUrl',
      'url',
      'src',
      'href',
      'iframe',
      'srcdoc',
      'loader',
      'import',
      'allowedOrigins',
      'egressAllowlist',
      'egressPolicy',
      'connectSrc',
      'apiBaseUrl',
      'remoteApiBaseUrl',
      'providerBaseUrl',
      'webhookUrl',
      'callbackUrl',
    ]);

    for (const extension of INSTALLED_COCKPIT_EXTENSION_MODULES) {
      expect(findForbiddenManifestKeys(extension.manifest, forbiddenKeys)).toEqual([]);
    }
  });

  it('exposes deterministic installed external route id and path pairs', () => {
    expect(INSTALLED_COCKPIT_ROUTE_HOST_PACK_IDS).toEqual(['example.reference']);
    expect(INSTALLED_COCKPIT_ROUTE_HOST_PROBLEMS).toEqual([]);
    expect(
      INSTALLED_COCKPIT_ROUTE_HOST_DEFINITIONS.map((definition) => [
        definition.routeId,
        definition.path,
      ]),
    ).toEqual([
      ['example-reference-detail', '/external/example-reference/details/$itemId'],
      ['example-reference-overview', '/external/example-reference/overview'],
    ]);
  });
});

function findForbiddenManifestKeys(
  value: unknown,
  forbiddenKeys: ReadonlySet<string>,
  path = 'manifest',
): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findForbiddenManifestKeys(item, forbiddenKeys, `${path}[${index}]`),
    );
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [
    ...(forbiddenKeys.has(key) ? [`${path}.${key}`] : []),
    ...findForbiddenManifestKeys(child, forbiddenKeys, `${path}.${key}`),
  ]);
}
