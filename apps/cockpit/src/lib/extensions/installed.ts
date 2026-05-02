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
  CockpitExtensionRegistryProblem,
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

export const INSTALLED_COCKPIT_EXTENSION_CATALOG_PROBLEMS =
  validateInstalledCockpitExtensionModules(INSTALLED_COCKPIT_EXTENSION_MODULES);

export const INSTALLED_COCKPIT_EXTENSIONS = INSTALLED_COCKPIT_EXTENSION_MODULES.map(
  (extension) => extension.manifest,
);

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
  const registry = resolveCockpitExtensionRegistry({
    ...input,
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
  const problems: CockpitExtensionRegistryProblem[] = [];
  const extensionId = extension.manifest.id;
  const packageName = extension.packageRef?.packageName?.trim();
  const manifestPackIds = extension.manifest.packIds;
  const workspacePackIds = extension.workspacePackRefs?.map((ref) => ref.packId) ?? [];
  const manifestRouteIds = extension.manifest.routes.map((route) => route.id);
  const routeModuleIds = extension.routeModules.map((routeModule) => routeModule.routeId);

  if (!packageName) {
    problems.push({
      code: 'missing-package-ref',
      message: `Installed extension "${extensionId}" must declare a host-reviewed package reference.`,
      extensionId,
    });
  }
  if (
    extension.manifest.governance.versionPin.packageName !== extension.packageRef.packageName ||
    extension.manifest.governance.versionPin.version !== extension.packageRef.version
  ) {
    problems.push({
      code: 'governance-package-ref-mismatch',
      message: `Installed extension "${extensionId}" governance version pin must match its host-reviewed package reference.`,
      extensionId,
      itemId: extension.manifest.governance.versionPin.packageName,
    });
  }

  for (const packId of symmetricDifference(manifestPackIds, workspacePackIds)) {
    problems.push({
      code: 'install-pack-ref-mismatch',
      message: `Installed extension "${extensionId}" workspace pack ref "${packId}" must match its manifest pack IDs.`,
      extensionId,
      itemId: packId,
    });
  }

  for (const routeId of duplicateValues(routeModuleIds)) {
    problems.push({
      code: 'duplicate-route-module',
      message: `Installed extension "${extensionId}" declares duplicate route module "${routeId}".`,
      extensionId,
      itemId: routeId,
    });
  }

  for (const routeId of manifestRouteIds.filter((routeId) => !routeModuleIds.includes(routeId))) {
    problems.push({
      code: 'missing-route-module',
      message: `Installed extension "${extensionId}" route "${routeId}" must have a host-owned route module ref.`,
      extensionId,
      itemId: routeId,
    });
  }

  for (const routeId of routeModuleIds.filter((routeId) => !manifestRouteIds.includes(routeId))) {
    problems.push({
      code: 'undeclared-route-module',
      message: `Installed extension "${extensionId}" route module "${routeId}" is not declared by its manifest.`,
      extensionId,
      itemId: routeId,
    });
  }

  return problems;
}

function symmetricDifference(left: readonly string[], right: readonly string[]): string[] {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return [
    ...left.filter((value) => !rightSet.has(value)),
    ...right.filter((value) => !leftSet.has(value)),
  ];
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }
    seen.add(value);
  }

  return [...duplicates];
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
            ]
          : [],
      ),
    ),
  ];
}
