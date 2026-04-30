import {
  COCKPIT_EXTENSION_ICONS,
  COCKPIT_EXTENSION_PERSONAS,
  COCKPIT_EXTENSION_SURFACES,
  type CockpitExtensionCommand,
  type CockpitExtensionManifest,
  type CockpitExtensionNavItem,
  type CockpitExtensionRegistryProblem,
  type CockpitExtensionRouteRef,
  type ResolvedCockpitExtension,
  type ResolvedCockpitExtensionRegistry,
} from './types';

const allowedSurfaces = new Set<string>(COCKPIT_EXTENSION_SURFACES);
const allowedPersonas = new Set<string>(COCKPIT_EXTENSION_PERSONAS);
const allowedIcons = new Set<string>(COCKPIT_EXTENSION_ICONS);

export interface ResolveCockpitExtensionRegistryInput {
  installedExtensions: readonly CockpitExtensionManifest[];
  activePackIds: readonly string[];
}

export function resolveCockpitExtensionRegistry({
  installedExtensions,
  activePackIds,
}: ResolveCockpitExtensionRegistryInput): ResolvedCockpitExtensionRegistry {
  const activePacks = new Set(activePackIds);
  const extensionProblems = new Map<string, CockpitExtensionRegistryProblem[]>();
  const globalProblems: CockpitExtensionRegistryProblem[] = [];
  const routeIds = new Map<string, string>();
  const routePaths = new Map<string, string>();
  const navIds = new Map<string, string>();
  const commandIds = new Map<string, string>();
  const shortcutIds = new Map<string, string>();
  const extensionIds = new Set<string>();

  function addProblem(problem: CockpitExtensionRegistryProblem) {
    globalProblems.push(problem);
    if (!problem.extensionId) return;
    const problems = extensionProblems.get(problem.extensionId) ?? [];
    problems.push(problem);
    extensionProblems.set(problem.extensionId, problems);
  }

  for (const extension of installedExtensions) {
    if (extensionIds.has(extension.id)) {
      addProblem({
        code: 'duplicate-extension-id',
        message: `Extension id "${extension.id}" is already registered.`,
        extensionId: extension.id,
      });
    }
    extensionIds.add(extension.id);

    const localRouteIds = new Set(extension.routes.map((route) => route.id));
    validatePackActivation(extension, activePacks, addProblem);
    validateRoutes(extension, routeIds, routePaths, addProblem);
    validateNavItems(extension, localRouteIds, navIds, addProblem);
    validateCommands(extension, localRouteIds, commandIds, shortcutIds, addProblem);
  }

  const resolvedExtensions: ResolvedCockpitExtension[] = installedExtensions.map((manifest) => {
    const problems = extensionProblems.get(manifest.id) ?? [];
    const active = manifest.packIds.every((packId) => activePacks.has(packId));
    return {
      manifest,
      status: problems.length > 0 ? 'invalid' : active ? 'enabled' : 'disabled',
      problems,
    };
  });

  const enabledExtensions = resolvedExtensions.filter(
    (extension) => extension.status === 'enabled',
  );

  return {
    extensions: resolvedExtensions,
    routes: enabledExtensions.flatMap((extension) => extension.manifest.routes),
    navItems: enabledExtensions.flatMap((extension) => extension.manifest.navItems),
    commands: enabledExtensions.flatMap((extension) => extension.manifest.commands),
    problems: globalProblems,
  };
}

export function selectExtensionNavItems(
  registry: ResolvedCockpitExtensionRegistry,
  surface: string,
  persona: string,
): CockpitExtensionNavItem[] {
  return registry.navItems.filter(
    (item) => item.surfaces.includes(surface as never) && item.personas.includes(persona as never),
  );
}

export function selectExtensionCommands(
  registry: ResolvedCockpitExtensionRegistry,
): CockpitExtensionCommand[] {
  return [...registry.commands];
}

function validatePackActivation(
  extension: CockpitExtensionManifest,
  activePacks: ReadonlySet<string>,
  addProblem: (problem: CockpitExtensionRegistryProblem) => void,
) {
  if (extension.packIds.length > 0) return;
  addProblem({
    code: 'missing-pack-activation',
    message: `Extension "${extension.id}" must declare at least one pack activation key.`,
    extensionId: extension.id,
  });

  for (const packId of extension.packIds) {
    void activePacks.has(packId);
  }
}

function validateRoutes(
  extension: CockpitExtensionManifest,
  routeIds: Map<string, string>,
  routePaths: Map<string, string>,
  addProblem: (problem: CockpitExtensionRegistryProblem) => void,
) {
  for (const route of extension.routes) {
    addDuplicateProblem(routeIds, route.id, extension.id, 'route id', {
      code: 'duplicate-route-id',
      extensionId: extension.id,
      itemId: route.id,
      addProblem,
    });
    addDuplicateProblem(routePaths, route.path, extension.id, 'route path', {
      code: 'duplicate-route-path',
      extensionId: extension.id,
      itemId: route.id,
      addProblem,
    });
    if (!route.guard || route.guard.personas.length === 0) {
      addProblem({
        code: 'missing-route-guard',
        message: `Route "${route.id}" must declare host-owned guard metadata.`,
        extensionId: extension.id,
        itemId: route.id,
      });
      continue;
    }
    if (!route.path.startsWith('/external/')) {
      addProblem({
        code: 'invalid-external-path',
        message: `Route "${route.id}" must live under the /external/ path boundary.`,
        extensionId: extension.id,
        itemId: route.id,
      });
    }
    validatePersonas(extension.id, route.id, route.guard.personas, addProblem);
  }
}

function validateNavItems(
  extension: CockpitExtensionManifest,
  localRouteIds: ReadonlySet<string>,
  navIds: Map<string, string>,
  addProblem: (problem: CockpitExtensionRegistryProblem) => void,
) {
  for (const item of extension.navItems) {
    addDuplicateProblem(navIds, item.id, extension.id, 'nav id', {
      code: 'duplicate-nav-id',
      extensionId: extension.id,
      itemId: item.id,
      addProblem,
    });
    if (!localRouteIds.has(item.routeId)) {
      addProblem({
        code: 'missing-route',
        message: `Nav item "${item.id}" references missing route "${item.routeId}".`,
        extensionId: extension.id,
        itemId: item.id,
      });
    }
    if (item.to.includes('$')) {
      addProblem({
        code: 'invalid-direct-nav-target',
        message: `Nav item "${item.id}" targets parameterized route "${item.to}".`,
        extensionId: extension.id,
        itemId: item.id,
      });
    }
    if (!allowedIcons.has(item.icon)) {
      addProblem({
        code: 'invalid-icon',
        message: `Nav item "${item.id}" uses unsupported icon "${item.icon}".`,
        extensionId: extension.id,
        itemId: item.id,
      });
    }
    for (const surface of item.surfaces) {
      if (!allowedSurfaces.has(surface)) {
        addProblem({
          code: 'invalid-surface',
          message: `Nav item "${item.id}" uses unsupported surface "${surface}".`,
          extensionId: extension.id,
          itemId: item.id,
        });
      }
    }
    validatePersonas(extension.id, item.id, item.personas, addProblem);
  }
}

function validateCommands(
  extension: CockpitExtensionManifest,
  localRouteIds: ReadonlySet<string>,
  commandIds: Map<string, string>,
  shortcutIds: Map<string, string>,
  addProblem: (problem: CockpitExtensionRegistryProblem) => void,
) {
  for (const command of extension.commands) {
    addDuplicateProblem(commandIds, command.id, extension.id, 'command id', {
      code: 'duplicate-command-id',
      extensionId: extension.id,
      itemId: command.id,
      addProblem,
    });
    if (command.routeId && !localRouteIds.has(command.routeId)) {
      addProblem({
        code: 'missing-route',
        message: `Command "${command.id}" references missing route "${command.routeId}".`,
        extensionId: extension.id,
        itemId: command.id,
      });
    }
    if (command.shortcut) {
      addDuplicateProblem(shortcutIds, command.shortcut, extension.id, 'shortcut', {
        code: 'duplicate-shortcut',
        extensionId: extension.id,
        itemId: command.id,
        addProblem,
      });
    }
  }
}

function validatePersonas(
  extensionId: string,
  itemId: string,
  personas: readonly string[],
  addProblem: (problem: CockpitExtensionRegistryProblem) => void,
) {
  for (const persona of personas) {
    if (!allowedPersonas.has(persona)) {
      addProblem({
        code: 'invalid-persona',
        message: `Item "${itemId}" uses unsupported persona "${persona}".`,
        extensionId,
        itemId,
      });
    }
  }
}

function addDuplicateProblem(
  seen: Map<string, string>,
  value: string,
  extensionId: string,
  label: string,
  options: {
    code: CockpitExtensionRegistryProblem['code'];
    extensionId: string;
    itemId: string;
    addProblem: (problem: CockpitExtensionRegistryProblem) => void;
  },
) {
  const existing = seen.get(value);
  if (existing) {
    options.addProblem({
      code: options.code,
      message: `Duplicate ${label} "${value}" from "${extensionId}" conflicts with "${existing}".`,
      extensionId: options.extensionId,
      itemId: options.itemId,
    });
    return;
  }
  seen.set(value, extensionId);
}
