import { EXAMPLE_OPS_DEMO_EXTENSION } from './example-ops-demo/manifest';
import { EXAMPLE_OPS_DEMO_ROUTE_LOADERS } from './example-ops-demo/route-loaders';
import { resolveCockpitExtensionRegistry } from './registry';
import type {
  CockpitExtensionManifest,
  CockpitExtensionRouteModuleLoader,
  CockpitExtensionRouteModuleRef,
} from './types';

export interface InstalledCockpitExtension {
  manifest: CockpitExtensionManifest;
  routeModules: readonly CockpitExtensionRouteModuleRef[];
}

export const INSTALLED_COCKPIT_EXTENSION_MODULES = [
  {
    manifest: EXAMPLE_OPS_DEMO_EXTENSION,
    routeModules: Object.entries(EXAMPLE_OPS_DEMO_ROUTE_LOADERS).map(([routeId, loadModule]) => ({
      routeId,
      loadModule,
    })),
  },
] as const satisfies readonly InstalledCockpitExtension[];

export const INSTALLED_COCKPIT_EXTENSIONS = INSTALLED_COCKPIT_EXTENSION_MODULES.map(
  (extension) => extension.manifest,
);

export const INSTALLED_COCKPIT_ROUTE_LOADERS = Object.fromEntries(
  INSTALLED_COCKPIT_EXTENSION_MODULES.flatMap((extension) =>
    extension.routeModules.map((routeModule) => [routeModule.routeId, routeModule.loadModule]),
  ),
) as Readonly<Record<string, CockpitExtensionRouteModuleLoader>>;

export const DEFAULT_ACTIVE_EXTENSION_PACK_IDS = ['example.ops-demo'] as const;

export const DEFAULT_COCKPIT_EXTENSION_REGISTRY = resolveCockpitExtensionRegistry({
  installedExtensions: INSTALLED_COCKPIT_EXTENSIONS,
  activePackIds: DEFAULT_ACTIVE_EXTENSION_PACK_IDS,
  routeLoaders: INSTALLED_COCKPIT_ROUTE_LOADERS,
});
