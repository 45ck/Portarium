import {
  COCKPIT_EXTENSION_ICONS,
  COCKPIT_EXTENSION_PERSONAS,
  COCKPIT_EXTENSION_SURFACES,
  type CockpitExtensionAccessContext,
  type CockpitExtensionAccessDecision,
  type CockpitExtensionAccessDenial,
  type CockpitExtensionCommand,
  type CockpitExtensionDisableReason,
  type CockpitExtensionManifest,
  type CockpitExtensionNavItem,
  type CockpitExtensionRegistryProblem,
  type CockpitExtensionRouteRef,
  type CockpitExtensionRouteModuleLoader,
  type ResolvedCockpitExtension,
  type ResolvedCockpitExtensionRegistry,
} from './types';

const allowedSurfaces = new Set<string>(COCKPIT_EXTENSION_SURFACES);
const allowedPersonas = new Set<string>(COCKPIT_EXTENSION_PERSONAS);
const allowedIcons = new Set<string>(COCKPIT_EXTENSION_ICONS);

export interface ResolveCockpitExtensionRegistryInput {
  installedExtensions: readonly CockpitExtensionManifest[];
  activePackIds: readonly string[];
  quarantinedExtensionIds?: readonly string[];
  availableCapabilities?: readonly string[];
  availableApiScopes?: readonly string[];
  routeLoaders?: Readonly<Record<string, CockpitExtensionRouteModuleLoader | undefined>>;
}

export function resolveCockpitExtensionRegistry({
  installedExtensions,
  activePackIds,
  quarantinedExtensionIds = [],
  availableCapabilities,
  availableApiScopes,
  routeLoaders = {},
}: ResolveCockpitExtensionRegistryInput): ResolvedCockpitExtensionRegistry {
  const activePacks = new Set(activePackIds);
  const quarantinedExtensions = new Set(quarantinedExtensionIds);
  const accessContext = { availableCapabilities, availableApiScopes };
  const extensionProblems = new Map<string, CockpitExtensionRegistryProblem[]>();
  const extensionDisableReasons = new Map<string, CockpitExtensionDisableReason[]>();
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
    const active = isExtensionActive(extension, activePacks);
    if (!active) continue;

    if (quarantinedExtensions.has(extension.id)) {
      extensionDisableReasons.set(extension.id, [
        {
          code: 'security-quarantine',
          message: `Extension "${extension.id}" is quarantined by the workspace activation source.`,
        },
      ]);
      continue;
    }

    const disableReasons = getManifestDisableReasons(extension, accessContext);
    if (disableReasons.length > 0) {
      extensionDisableReasons.set(extension.id, disableReasons);
      continue;
    }

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
    validateRoutes(extension, routeIds, routePaths, routeLoaders, addProblem);
    validateNavItems(extension, localRouteIds, navIds, addProblem);
    validateCommands(extension, localRouteIds, commandIds, shortcutIds, addProblem);
  }

  const resolvedExtensions: ResolvedCockpitExtension[] = installedExtensions.map((manifest) => {
    const problems = extensionProblems.get(manifest.id) ?? [];
    const active = isExtensionActive(manifest, activePacks);
    const disableReasons = active ? (extensionDisableReasons.get(manifest.id) ?? []) : [];
    const quarantined = active && quarantinedExtensions.has(manifest.id);
    return {
      manifest,
      status:
        problems.length > 0
          ? 'invalid'
          : quarantined
            ? 'quarantined'
            : active && disableReasons.length === 0
              ? 'enabled'
              : 'disabled',
      problems,
      disableReasons,
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
  context: Omit<CockpitExtensionAccessContext, 'persona'> = {},
): CockpitExtensionNavItem[] {
  return registry.navItems.filter(
    (item) =>
      item.surfaces.includes(surface as never) &&
      canAccessExtensionNavItem(item, { ...context, persona }).allowed,
  );
}

export function selectExtensionCommands(
  registry: ResolvedCockpitExtensionRegistry,
  persona?: string,
  context: Omit<CockpitExtensionAccessContext, 'persona'> = {},
): CockpitExtensionCommand[] {
  return registry.commands.filter(
    (command) => canAccessExtensionCommand(command, registry, { ...context, persona }).allowed,
  );
}

export function selectExtensionRoutes(
  registry: ResolvedCockpitExtensionRegistry,
  context: CockpitExtensionAccessContext = {},
): CockpitExtensionRouteRef[] {
  return registry.routes.filter((route) => canAccessExtensionRoute(route, context).allowed);
}

export function canAccessExtensionRoute(
  route: CockpitExtensionRouteRef,
  context: CockpitExtensionAccessContext = {},
): CockpitExtensionAccessDecision {
  return decideAccess(
    {
      personas: route.guard.personas,
      requiredCapabilities: route.guard.requiredCapabilities,
      requiredApiScopes: route.guard.requiredApiScopes,
    },
    context,
  );
}

export function canAccessExtensionNavItem(
  item: CockpitExtensionNavItem,
  context: CockpitExtensionAccessContext = {},
): CockpitExtensionAccessDecision {
  return decideAccess(
    {
      personas: item.personas,
      requiredCapabilities: item.requiredCapabilities ?? [],
      requiredApiScopes: item.requiredApiScopes ?? [],
    },
    context,
  );
}

export function canAccessExtensionCommand(
  command: CockpitExtensionCommand,
  registry: ResolvedCockpitExtensionRegistry,
  context: CockpitExtensionAccessContext = {},
): CockpitExtensionAccessDecision {
  const route = command.routeId
    ? registry.routes.find((candidate) => candidate.id === command.routeId)
    : undefined;

  return decideAccess(
    {
      personas: route?.guard.personas ?? [],
      requiredCapabilities: uniqueStrings([
        ...(route?.guard.requiredCapabilities ?? []),
        ...(command.requiredCapabilities ?? []),
      ]),
      requiredApiScopes: uniqueStrings([
        ...(route?.guard.requiredApiScopes ?? []),
        ...(command.requiredApiScopes ?? []),
      ]),
    },
    context,
  );
}

function isExtensionActive(
  extension: CockpitExtensionManifest,
  activePacks: ReadonlySet<string>,
): boolean {
  return extension.packIds.every((packId) => activePacks.has(packId));
}

function getManifestDisableReasons(
  extension: CockpitExtensionManifest,
  context: Pick<CockpitExtensionAccessContext, 'availableCapabilities' | 'availableApiScopes'>,
): CockpitExtensionDisableReason[] {
  const reasons: CockpitExtensionDisableReason[] = [];
  const missingCapabilities = getMissingRequirements(
    extension.requiredCapabilities,
    context.availableCapabilities,
  );
  const missingApiScopes = getMissingRequirements(
    extension.requiredApiScopes,
    context.availableApiScopes,
  );

  if (missingCapabilities.length > 0) {
    reasons.push({
      code: 'missing-capability',
      message: `Extension "${extension.id}" requires unavailable capabilities: ${missingCapabilities.join(', ')}.`,
    });
  }
  if (missingApiScopes.length > 0) {
    reasons.push({
      code: 'missing-api-scope',
      message: `Extension "${extension.id}" requires unavailable API scopes: ${missingApiScopes.join(', ')}.`,
    });
  }

  return reasons;
}

function decideAccess(
  requirement: {
    personas: readonly string[];
    requiredCapabilities: readonly string[];
    requiredApiScopes: readonly string[];
  },
  context: CockpitExtensionAccessContext,
): CockpitExtensionAccessDecision {
  const denials: CockpitExtensionAccessDenial[] = [];

  const personaDenied = getPersonaDenied(requirement.personas, context);
  if (personaDenied) {
    denials.push({ code: 'persona' });
  }

  const missingCapabilities = getMissingRequirements(
    requirement.requiredCapabilities,
    context.availableCapabilities,
  );
  const missingApiScopes = getMissingRequirements(
    requirement.requiredApiScopes,
    context.availableApiScopes,
  );

  if (missingCapabilities.length > 0) {
    denials.push({ code: 'missing-capability', missing: missingCapabilities });
  }
  if (missingApiScopes.length > 0) {
    denials.push({ code: 'missing-api-scope', missing: missingApiScopes });
  }

  return {
    allowed: denials.length === 0,
    denials,
  };
}

function getMissingRequirements(
  required: readonly string[],
  available: readonly string[] | undefined,
): string[] {
  if (required.length === 0) return [];
  if (!available) return [...required];
  const availableSet = new Set(available);
  return required.filter((requirement) => !availableSet.has(requirement));
}

function getPersonaDenied(
  requiredPersonas: readonly string[],
  context: CockpitExtensionAccessContext,
): boolean {
  if (requiredPersonas.length === 0) return false;

  if (context.availablePersonas) {
    if (!context.persona) return true;
    return (
      !requiredPersonas.includes(context.persona) ||
      !context.availablePersonas.includes(context.persona)
    );
  }

  return Boolean(context.persona && !requiredPersonas.includes(context.persona));
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
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
  routeLoaders: Readonly<Record<string, CockpitExtensionRouteModuleLoader | undefined>>,
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
    if (typeof routeLoaders[route.id] !== 'function') {
      addProblem({
        code: 'missing-route-module',
        message: `Route "${route.id}" must have a compile-time route module loader before the extension can be enabled.`,
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
