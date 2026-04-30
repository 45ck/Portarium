import {
  resolveCockpitExtensionRegistry,
  type ResolveCockpitExtensionRegistryInput,
} from './registry';
import type { CockpitExtensionRegistryProblem } from './types';

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
  const problems = registry.problems;

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

function compareRouteHostDefinitions(
  left: CockpitExtensionRouteHostDefinition,
  right: CockpitExtensionRouteHostDefinition,
): number {
  return left.path.localeCompare(right.path) || left.routeId.localeCompare(right.routeId);
}
