import { EXAMPLE_REFERENCE_EXTENSION } from './example-reference/manifest';
import { EXAMPLE_REFERENCE_ROUTE_LOADERS } from './example-reference/route-loaders';
import {
  resolveCockpitExtensionRegistry,
  type ResolveCockpitExtensionRegistryInput,
} from './registry';
import { resolveCockpitExtensionRouteHostDefinitions } from './route-host';
import type {
  CockpitExtensionAccessContext,
  CockpitInstalledExtension,
  CockpitExtensionRouteModuleLoader,
  ResolvedCockpitExtensionRegistry,
} from './types';

export type ResolveInstalledCockpitExtensionRegistryInput = Omit<
  ResolveCockpitExtensionRegistryInput,
  'installedExtensions' | 'routeLoaders'
>;

export const INSTALLED_COCKPIT_EXTENSION_MODULES = [
  {
    manifest: EXAMPLE_REFERENCE_EXTENSION,
    routeModules: Object.entries(EXAMPLE_REFERENCE_ROUTE_LOADERS).map(([routeId, loadModule]) => ({
      routeId,
      loadModule,
    })),
    workspacePackRefs: [{ packId: 'example.reference' }],
  },
] as const satisfies readonly CockpitInstalledExtension[];

export const INSTALLED_COCKPIT_EXTENSIONS = INSTALLED_COCKPIT_EXTENSION_MODULES.map(
  (extension) => extension.manifest,
);

export const INSTALLED_COCKPIT_ROUTE_LOADERS = Object.fromEntries(
  INSTALLED_COCKPIT_EXTENSION_MODULES.flatMap((extension) =>
    extension.routeModules.map((routeModule) => [routeModule.routeId, routeModule.loadModule]),
  ),
) as Readonly<Record<string, CockpitExtensionRouteModuleLoader>>;

export const INSTALLED_COCKPIT_ROUTE_PATHS = new Map(
  INSTALLED_COCKPIT_EXTENSIONS.flatMap((extension) =>
    extension.routes.map((route) => [route.id, route.path] as const),
  ),
) as ReadonlyMap<string, string>;

export const DEFAULT_ACTIVE_EXTENSION_PACK_IDS = ['example.reference'] as const;

export const DEFAULT_COCKPIT_EXTENSION_ACCESS_CONTEXT = {
  availableCapabilities: collectInstalledRequirements('requiredCapabilities'),
  availableApiScopes: collectInstalledRequirements('requiredApiScopes'),
} as const satisfies Pick<
  CockpitExtensionAccessContext,
  'availableCapabilities' | 'availableApiScopes'
>;

export const DEFAULT_COCKPIT_EXTENSION_REGISTRY = resolveCockpitExtensionRegistry({
  installedExtensions: INSTALLED_COCKPIT_EXTENSIONS,
  activePackIds: DEFAULT_ACTIVE_EXTENSION_PACK_IDS,
  ...DEFAULT_COCKPIT_EXTENSION_ACCESS_CONTEXT,
  routeLoaders: INSTALLED_COCKPIT_ROUTE_LOADERS,
});

const installedRouteHostResolution = resolveCockpitExtensionRouteHostDefinitions({
  installedExtensions: INSTALLED_COCKPIT_EXTENSIONS,
  activePackIds: DEFAULT_ACTIVE_EXTENSION_PACK_IDS,
  ...DEFAULT_COCKPIT_EXTENSION_ACCESS_CONTEXT,
  routeLoaders: INSTALLED_COCKPIT_ROUTE_LOADERS,
});

export const INSTALLED_COCKPIT_ROUTE_HOST_DEFINITIONS = installedRouteHostResolution.definitions;

export const INSTALLED_COCKPIT_ROUTE_HOST_PROBLEMS = installedRouteHostResolution.problems;

export function resolveInstalledCockpitExtensionRegistry(
  input: ResolveInstalledCockpitExtensionRegistryInput,
): ResolvedCockpitExtensionRegistry {
  return resolveCockpitExtensionRegistry({
    ...input,
    installedExtensions: INSTALLED_COCKPIT_EXTENSIONS,
    routeLoaders: INSTALLED_COCKPIT_ROUTE_LOADERS,
  });
}

function collectInstalledRequirements(
  key: 'requiredCapabilities' | 'requiredApiScopes',
): readonly string[] {
  return [
    ...new Set(
      INSTALLED_COCKPIT_EXTENSIONS.flatMap((extension) =>
        extension.packIds.every((packId) => DEFAULT_ACTIVE_EXTENSION_PACK_IDS.includes(packId))
          ? extension[key]
          : [],
      ),
    ),
  ];
}
