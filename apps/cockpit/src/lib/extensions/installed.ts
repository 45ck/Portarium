import { EXAMPLE_REFERENCE_EXTENSION } from './example-reference/manifest';
import { EXAMPLE_REFERENCE_ROUTE_LOADERS } from './example-reference/route-loaders';
import { createCockpitExtensionManifestV1ConformanceReport } from '@portarium/cockpit-extension-sdk';
import {
  LOCAL_COCKPIT_EXTENSION_INSTALL_PROBLEMS,
  LOCAL_COCKPIT_EXTENSION_MODULES,
} from './local-install';
import {
  resolveCockpitExtensionRegistry,
  type ResolveCockpitExtensionRegistryInput,
} from './registry';
import { resolveCockpitExtensionRouteHostDefinitions } from './route-host';
import type {
  CockpitExtensionAccessContext,
  CockpitInstalledExtension,
  CockpitExtensionManifest,
  CockpitExtensionRegistryProblem,
  CockpitExtensionRouteModuleLoader,
  ResolvedCockpitExtensionRegistry,
} from './types';

export type ResolveInstalledCockpitExtensionRegistryInput = Omit<
  ResolveCockpitExtensionRegistryInput,
  'installedExtensions' | 'routeLoaders'
>;

const BUILT_IN_COCKPIT_EXTENSION_MODULES = [
  {
    manifest: EXAMPLE_REFERENCE_EXTENSION,
    packageRef: {
      packageName: '@portarium/cockpit-example-reference-extension',
      version: '0.1.0',
      workspacePath: 'apps/cockpit/src/lib/extensions/example-reference',
    },
    routeModules: Object.entries(EXAMPLE_REFERENCE_ROUTE_LOADERS).map(([routeId, loadModule]) => ({
      routeId,
      loadModule,
    })),
    workspacePackRefs: [{ packId: 'example.reference' }],
  },
] as const satisfies readonly CockpitInstalledExtension[];

export const INSTALLED_COCKPIT_EXTENSION_MODULES = [
  ...BUILT_IN_COCKPIT_EXTENSION_MODULES,
  ...LOCAL_COCKPIT_EXTENSION_MODULES,
] as const satisfies readonly CockpitInstalledExtension[];

export const INSTALLED_COCKPIT_EXTENSION_CATALOG_PROBLEMS = [
  ...LOCAL_COCKPIT_EXTENSION_INSTALL_PROBLEMS,
  ...validateInstalledCockpitExtensionModules(INSTALLED_COCKPIT_EXTENSION_MODULES),
] as const;

export const INSTALLED_COCKPIT_EXTENSIONS: readonly CockpitExtensionManifest[] =
  INSTALLED_COCKPIT_EXTENSION_MODULES.map((extension) => extension.manifest);

export const INSTALLED_COCKPIT_ROUTE_LOADERS = buildInstalledCockpitRouteLoaders(
  INSTALLED_COCKPIT_EXTENSION_MODULES,
);

export const INSTALLED_COCKPIT_ROUTE_PATHS = new Map(
  INSTALLED_COCKPIT_EXTENSIONS.flatMap((extension) =>
    extension.routes.map((route) => [route.id, route.path] as const),
  ),
) as ReadonlyMap<string, string>;

export const DEFAULT_ACTIVE_EXTENSION_PACK_IDS = [] as const;

export const INSTALLED_COCKPIT_ROUTE_HOST_PACK_IDS = [
  ...new Set(INSTALLED_COCKPIT_EXTENSIONS.flatMap((extension) => extension.packIds)),
] as const;

export const DEFAULT_COCKPIT_EXTENSION_ACCESS_CONTEXT = {
  availableCapabilities: [],
  availableApiScopes: [],
  availablePrivacyClasses: [],
} as const satisfies Pick<
  CockpitExtensionAccessContext,
  'availableCapabilities' | 'availableApiScopes' | 'availablePrivacyClasses'
>;

const INSTALLED_COCKPIT_ROUTE_HOST_ACCESS_CONTEXT = {
  availableCapabilities: collectInstalledRequirements(
    'requiredCapabilities',
    INSTALLED_COCKPIT_ROUTE_HOST_PACK_IDS,
  ),
  availableApiScopes: collectInstalledRequirements(
    'requiredApiScopes',
    INSTALLED_COCKPIT_ROUTE_HOST_PACK_IDS,
  ),
  availablePrivacyClasses: collectInstalledPrivacyClasses(INSTALLED_COCKPIT_ROUTE_HOST_PACK_IDS),
} as const satisfies Pick<
  CockpitExtensionAccessContext,
  'availableCapabilities' | 'availableApiScopes' | 'availablePrivacyClasses'
>;

export const DEFAULT_COCKPIT_EXTENSION_REGISTRY = appendInstalledCatalogProblems(
  resolveCockpitExtensionRegistry({
    installedExtensions: INSTALLED_COCKPIT_EXTENSIONS,
    activePackIds: DEFAULT_ACTIVE_EXTENSION_PACK_IDS,
    ...DEFAULT_COCKPIT_EXTENSION_ACCESS_CONTEXT,
    routeLoaders: INSTALLED_COCKPIT_ROUTE_LOADERS,
  }),
);

const installedRouteHostResolution = resolveCockpitExtensionRouteHostDefinitions({
  installedExtensions: INSTALLED_COCKPIT_EXTENSIONS,
  activePackIds: INSTALLED_COCKPIT_ROUTE_HOST_PACK_IDS,
  ...INSTALLED_COCKPIT_ROUTE_HOST_ACCESS_CONTEXT,
  routeLoaders: INSTALLED_COCKPIT_ROUTE_LOADERS,
});

export const INSTALLED_COCKPIT_ROUTE_HOST_DEFINITIONS = installedRouteHostResolution.definitions;

export const INSTALLED_COCKPIT_ROUTE_HOST_PROBLEMS = installedRouteHostResolution.problems;

export function resolveInstalledCockpitExtensionRegistry(
  input: ResolveInstalledCockpitExtensionRegistryInput,
): ResolvedCockpitExtensionRegistry {
  const effectiveInput = withLocalCockpitExtensionActivation(input);
  const registry = resolveCockpitExtensionRegistry({
    ...effectiveInput,
    installedExtensions: INSTALLED_COCKPIT_EXTENSIONS,
    routeLoaders: INSTALLED_COCKPIT_ROUTE_LOADERS,
  });

  return appendInstalledCatalogProblems(registry);
}

function appendInstalledCatalogProblems(
  registry: ResolvedCockpitExtensionRegistry,
): ResolvedCockpitExtensionRegistry {
  if (INSTALLED_COCKPIT_EXTENSION_CATALOG_PROBLEMS.length === 0) return registry;

  const installedProblemsByExtension = new Map<string, CockpitExtensionRegistryProblem[]>();
  for (const problem of INSTALLED_COCKPIT_EXTENSION_CATALOG_PROBLEMS) {
    if (!problem.extensionId) continue;
    const problems = installedProblemsByExtension.get(problem.extensionId) ?? [];
    problems.push(problem);
    installedProblemsByExtension.set(problem.extensionId, problems);
  }

  return {
    ...registry,
    extensions: registry.extensions.map((extension) => {
      const installedProblems = installedProblemsByExtension.get(extension.manifest.id) ?? [];
      if (installedProblems.length === 0) return extension;

      return {
        ...extension,
        status: 'invalid',
        problems: [...extension.problems, ...installedProblems],
      };
    }),
    routes: [],
    navItems: [],
    commands: [],
    widgets: [],
    dataScopes: [],
    problems: [...registry.problems, ...INSTALLED_COCKPIT_EXTENSION_CATALOG_PROBLEMS],
  };
}

export function validateInstalledCockpitExtensionModules(
  installedModules: readonly CockpitInstalledExtension[],
): readonly CockpitExtensionRegistryProblem[] {
  return installedModules.flatMap(validateInstalledCockpitExtensionModule);
}

export function buildInstalledCockpitRouteLoaders(
  installedModules: readonly CockpitInstalledExtension[],
): Readonly<Record<string, CockpitExtensionRouteModuleLoader>> {
  const loaders: Record<string, CockpitExtensionRouteModuleLoader> = {};

  for (const extension of installedModules) {
    for (const routeModule of extension.routeModules) {
      if (typeof routeModule.loadModule !== 'function' || loaders[routeModule.routeId]) continue;
      loaders[routeModule.routeId] = routeModule.loadModule;
    }
  }

  return loaders;
}

function validateInstalledCockpitExtensionModule(
  extension: CockpitInstalledExtension,
): CockpitExtensionRegistryProblem[] {
  return [
    ...createCockpitExtensionManifestV1ConformanceReport({
      manifest: extension.manifest,
      packageRef: extension.packageRef,
      workspacePackRefs: extension.workspacePackRefs,
      routeModuleIds: extension.routeModules.map((routeModule) => routeModule.routeId),
    }).problems,
  ];
}

function collectInstalledRequirements(
  key: 'requiredCapabilities' | 'requiredApiScopes',
  activePackIds: readonly string[],
): readonly string[] {
  return [
    ...new Set(
      INSTALLED_COCKPIT_EXTENSIONS.flatMap((extension) =>
        extension.packIds.every((packId) => activePackIds.includes(packId)) ? extension[key] : [],
      ),
    ),
  ];
}

function collectInstalledPrivacyClasses(activePackIds: readonly string[]): readonly string[] {
  return [
    ...new Set(
      INSTALLED_COCKPIT_EXTENSIONS.flatMap((extension) =>
        extension.packIds.every((packId) => activePackIds.includes(packId))
          ? [
              ...extension.routes.flatMap((route) => route.guard.privacyClasses ?? []),
              ...extension.commands.flatMap((command) => command.guard.privacyClasses ?? []),
              ...(extension.dataScopes ?? []).flatMap((scope) => scope.guard.privacyClasses ?? []),
              ...(extension.widgets ?? []).flatMap((widget) => widget.guard.privacyClasses ?? []),
            ]
          : [],
      ),
    ),
  ];
}

export function withLocalCockpitExtensionActivation(
  input: ResolveInstalledCockpitExtensionRegistryInput,
): ResolveInstalledCockpitExtensionRegistryInput {
  if (LOCAL_COCKPIT_EXTENSION_MODULES.length === 0) return input;

  const localPackIds = [
    ...new Set(LOCAL_COCKPIT_EXTENSION_MODULES.flatMap((extension) => extension.manifest.packIds)),
  ];

  return {
    ...input,
    activePackIds: uniqueStrings([...input.activePackIds, ...localPackIds]),
    availablePersonas: uniqueStrings([
      ...(input.availablePersonas ?? []),
      ...LOCAL_COCKPIT_EXTENSION_MODULES.flatMap((extension) => extension.manifest.personas),
    ]),
    availableCapabilities: uniqueStrings([
      ...(input.availableCapabilities ?? []),
      ...collectInstalledRequirements('requiredCapabilities', localPackIds),
    ]),
    availableApiScopes: uniqueStrings([
      ...(input.availableApiScopes ?? []),
      ...collectInstalledRequirements('requiredApiScopes', localPackIds),
    ]),
    availablePrivacyClasses: uniqueStrings([
      ...(input.availablePrivacyClasses ?? []),
      ...collectInstalledPrivacyClasses(localPackIds),
    ]),
  };
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
