import {
  resolveCockpitExtensionRegistry,
  type ResolveCockpitExtensionRegistryInput,
} from './registry';
import type { CockpitExtensionRegistryProblem, CockpitExtensionRouteModuleLoader } from './types';

export interface CockpitExtensionRouteHostDefinition {
  extensionId: string;
  routeId: string;
  path: string;
}

export type ResolveCockpitExtensionRouteHostDefinitionsInput = ResolveCockpitExtensionRegistryInput;

export interface ResolvedCockpitExtensionRouteHostDefinitions {
  definitions: readonly CockpitExtensionRouteHostDefinition[];
  problems: readonly CockpitExtensionRegistryProblem[];
}

export function resolveCockpitExtensionRouteHostDefinitions(
  input: ResolveCockpitExtensionRouteHostDefinitionsInput,
): ResolvedCockpitExtensionRouteHostDefinitions {
  const registry = resolveCockpitExtensionRegistry(input);
  const loaderProblems = findUndeclaredRouteModuleProblems(
    input.routeLoaders ?? {},
    input.installedExtensions.flatMap((extension) => extension.routes.map((route) => route.id)),
  );
  const problems = [...registry.problems, ...loaderProblems];

  if (problems.length > 0) {
    return { definitions: [], problems };
  }

  const definitions = registry.extensions
    .filter((extension) => extension.status === 'enabled')
    .flatMap((extension) =>
      extension.manifest.routes.map((route) => ({
        extensionId: extension.manifest.id,
        routeId: route.id,
        path: route.path,
      })),
    )
    .sort(compareRouteHostDefinitions);

  return { definitions, problems: [] };
}

function findUndeclaredRouteModuleProblems(
  routeLoaders: Readonly<Record<string, CockpitExtensionRouteModuleLoader | undefined>>,
  declaredRouteIds: readonly string[],
): CockpitExtensionRegistryProblem[] {
  const declaredRoutes = new Set(declaredRouteIds);

  return Object.keys(routeLoaders)
    .filter((routeId) => !declaredRoutes.has(routeId))
    .sort()
    .map((routeId) => ({
      code: 'undeclared-route-module',
      message: `Route module "${routeId}" is installed but no extension manifest declares it.`,
      itemId: routeId,
    }));
}

function compareRouteHostDefinitions(
  left: CockpitExtensionRouteHostDefinition,
  right: CockpitExtensionRouteHostDefinition,
): number {
  return left.path.localeCompare(right.path) || left.routeId.localeCompare(right.routeId);
}
