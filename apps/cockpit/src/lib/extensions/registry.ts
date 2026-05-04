import {
  COCKPIT_EXTENSION_ICONS,
  COCKPIT_EXTENSION_PERSONAS,
  COCKPIT_EXTENSION_PRIVACY_CLASSES,
  COCKPIT_EXTENSION_SURFACES,
  COCKPIT_EXTENSION_WIDGET_SURFACES,
  type CockpitExtensionAccessContext,
  type CockpitExtensionAccessDecision,
  type CockpitExtensionAccessDenial,
  type CockpitExtensionCommand,
  type CockpitExtensionDataScopeRef,
  type CockpitExtensionDisableReason,
  type CockpitExtensionManifest,
  type CockpitExtensionNavItem,
  type CockpitExtensionRegistryProblem,
  type CockpitExtensionRouteRef,
  type CockpitExtensionRouteModuleLoader,
  type CockpitExtensionWidgetRef,
  type ResolvedCockpitExtension,
  type ResolvedCockpitExtensionRegistry,
} from './types';

const allowedSurfaces = new Set<string>(COCKPIT_EXTENSION_SURFACES);
const allowedPersonas = new Set<string>(COCKPIT_EXTENSION_PERSONAS);
const allowedPrivacyClasses = new Set<string>(COCKPIT_EXTENSION_PRIVACY_CLASSES);
const allowedIcons = new Set<string>(COCKPIT_EXTENSION_ICONS);
const allowedWidgetSurfaces = new Set<string>(COCKPIT_EXTENSION_WIDGET_SURFACES);

export interface ResolveCockpitExtensionRegistryInput {
  installedExtensions: readonly CockpitExtensionManifest[];
  activePackIds: readonly string[];
  quarantinedExtensionIds?: readonly string[];
  emergencyDisabledExtensionIds?: readonly string[];
  availablePersonas?: readonly string[];
  availableCapabilities?: readonly string[];
  availableApiScopes?: readonly string[];
  availablePrivacyClasses?: readonly string[];
  routeLoaders?: Readonly<Record<string, CockpitExtensionRouteModuleLoader | undefined>>;
}

export function resolveCockpitExtensionRegistry({
  installedExtensions,
  activePackIds,
  quarantinedExtensionIds = [],
  emergencyDisabledExtensionIds = [],
  availablePersonas,
  availableCapabilities,
  availableApiScopes,
  availablePrivacyClasses,
  routeLoaders = {},
}: ResolveCockpitExtensionRegistryInput): ResolvedCockpitExtensionRegistry {
  const activePacks = new Set(activePackIds);
  const quarantinedExtensions = new Set(quarantinedExtensionIds);
  const emergencyDisabledExtensions = new Set(emergencyDisabledExtensionIds);
  const accessContext = {
    availablePersonas,
    availableCapabilities,
    availableApiScopes,
    availablePrivacyClasses,
  };
  const extensionProblems = new Map<string, CockpitExtensionRegistryProblem[]>();
  const extensionDisableReasons = new Map<string, CockpitExtensionDisableReason[]>();
  const globalProblems: CockpitExtensionRegistryProblem[] = [];
  const routeIds = new Map<string, string>();
  const routePaths = new Map<string, string>();
  const navIds = new Map<string, string>();
  const commandIds = new Map<string, string>();
  const shortcutIds = new Map<string, string>();
  const widgetIds = new Map<string, string>();
  const dataScopeIds = new Map<string, string>();
  const extensionIds = new Set<string>();
  const declaredPackIds = new Set(installedExtensions.flatMap((extension) => extension.packIds));
  const declaredRouteIds = new Set(
    installedExtensions.flatMap((extension) => extension.routes.map((route) => route.id)),
  );

  function addProblem(problem: CockpitExtensionRegistryProblem) {
    globalProblems.push(problem);
    if (!problem.extensionId) return;
    const problems = extensionProblems.get(problem.extensionId) ?? [];
    problems.push(problem);
    extensionProblems.set(problem.extensionId, problems);
  }

  for (const activePackId of activePacks) {
    if (!declaredPackIds.has(activePackId)) {
      addProblem({
        code: 'unknown-pack-activation',
        message: `Workspace activated unknown extension pack "${activePackId}".`,
        itemId: activePackId,
      });
    }
  }

  for (const routeId of Object.keys(routeLoaders).sort()) {
    if (!declaredRouteIds.has(routeId)) {
      addProblem({
        code: 'undeclared-route-module',
        message: `Route module "${routeId}" is installed but no extension manifest declares it.`,
        itemId: routeId,
      });
    }
  }

  for (const extension of installedExtensions) {
    const active = isExtensionActive(extension, activePacks);
    if (!active) {
      extensionDisableReasons.set(
        extension.id,
        getInactivePackDisableReasons(extension, activePacks),
      );
      continue;
    }

    if (emergencyDisabledExtensions.has(extension.id)) {
      extensionDisableReasons.set(extension.id, [
        {
          code: 'emergency-disabled',
          message: `Extension "${extension.id}" is emergency-disabled by the workspace activation source.`,
        },
      ]);
      continue;
    }

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

    const localRoutes = new Map(extension.routes.map((route) => [route.id, route]));
    validateGovernanceControls(extension, addProblem);
    validatePersonas(extension.id, extension.id, extension.personas, addProblem);
    validatePackActivation(extension, activePacks, addProblem);
    validateRoutes(extension, routeIds, routePaths, routeLoaders, addProblem);
    validateNavItems(extension, localRoutes, navIds, addProblem);
    validateCommands(extension, localRoutes, commandIds, shortcutIds, addProblem);
    validateDataScopes(extension, dataScopeIds, addProblem);
    validateWidgets(extension, localRoutes, widgetIds, addProblem);
  }

  const resolvedExtensions: ResolvedCockpitExtension[] = installedExtensions.map((manifest) => {
    const problems = extensionProblems.get(manifest.id) ?? [];
    const active = isExtensionActive(manifest, activePacks);
    const disableReasons = extensionDisableReasons.get(manifest.id) ?? [];
    const emergencyDisabled = active && emergencyDisabledExtensions.has(manifest.id);
    const quarantined = active && quarantinedExtensions.has(manifest.id);
    return {
      manifest,
      status:
        problems.length > 0
          ? 'invalid'
          : emergencyDisabled || quarantined
            ? emergencyDisabled
              ? 'emergency-disabled'
              : 'quarantined'
            : active && disableReasons.length === 0
              ? 'enabled'
              : 'disabled',
      problems,
      disableReasons,
    };
  });

  const enabledExtensions = resolvedExtensions.filter(
    (extension) => extension.status === 'enabled' && globalProblems.length === 0,
  );

  return {
    extensions: resolvedExtensions,
    routes: enabledExtensions.flatMap((extension) => extension.manifest.routes),
    navItems: enabledExtensions.flatMap((extension) => extension.manifest.navItems),
    commands: enabledExtensions.flatMap((extension) => extension.manifest.commands),
    widgets: enabledExtensions.flatMap((extension) => extension.manifest.widgets ?? []),
    dataScopes: enabledExtensions.flatMap((extension) => extension.manifest.dataScopes ?? []),
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
      canAccessExtensionNavItem(item, registry, { ...context, persona }).allowed,
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
      privacyClasses: route.guard.privacyClasses ?? [],
    },
    context,
  );
}

export function canAccessExtensionNavItem(
  item: CockpitExtensionNavItem,
  registry: ResolvedCockpitExtensionRegistry,
  context: CockpitExtensionAccessContext = {},
): CockpitExtensionAccessDecision {
  const route = registry.routes.find((candidate) => candidate.id === item.routeId);
  if (!route) return { allowed: false, denials: [{ code: 'route-unavailable' }] };
  return canAccessExtensionRoute(route, context);
}

export function canAccessExtensionCommand(
  command: CockpitExtensionCommand,
  registry: ResolvedCockpitExtensionRegistry,
  context: CockpitExtensionAccessContext = {},
): CockpitExtensionAccessDecision {
  const route = command.routeId
    ? registry.routes.find((candidate) => candidate.id === command.routeId)
    : undefined;
  if (command.routeId && !route) {
    return { allowed: false, denials: [{ code: 'route-unavailable' }] };
  }

  return decideAccess(
    {
      personas: combinePersonaRequirements(route?.guard.personas, command.guard.personas),
      requiredCapabilities: uniqueStrings([
        ...(route?.guard.requiredCapabilities ?? []),
        ...command.guard.requiredCapabilities,
        ...(command.requiredCapabilities ?? []),
      ]),
      requiredApiScopes: uniqueStrings([
        ...(route?.guard.requiredApiScopes ?? []),
        ...command.guard.requiredApiScopes,
        ...(command.requiredApiScopes ?? []),
      ]),
      privacyClasses: uniqueStrings([
        ...(route?.guard.privacyClasses ?? []),
        ...(command.guard.privacyClasses ?? []),
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

function getInactivePackDisableReasons(
  extension: CockpitExtensionManifest,
  activePacks: ReadonlySet<string>,
): CockpitExtensionDisableReason[] {
  const missingPackIds = extension.packIds.filter((packId) => !activePacks.has(packId));
  if (missingPackIds.length === 0) return [];

  return [
    {
      code: 'workspace-pack-inactive',
      message: `Extension "${extension.id}" requires inactive workspace pack activation keys: ${missingPackIds.join(', ')}.`,
    },
  ];
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
    privacyClasses: readonly string[];
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
  const missingPrivacyClasses = getMissingRequirements(
    requirement.privacyClasses,
    context.availablePrivacyClasses,
  );

  if (missingCapabilities.length > 0) {
    denials.push({ code: 'missing-capability', missing: missingCapabilities });
  }
  if (missingApiScopes.length > 0) {
    denials.push({ code: 'missing-api-scope', missing: missingApiScopes });
  }
  if (missingPrivacyClasses.length > 0) {
    denials.push({ code: 'missing-privacy-class', missing: missingPrivacyClasses });
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
  if (!context.persona) return true;

  if (context.availablePersonas) {
    return (
      !requiredPersonas.includes(context.persona) ||
      !context.availablePersonas.includes(context.persona)
    );
  }

  return !requiredPersonas.includes(context.persona);
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
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

function combinePersonaRequirements(
  routePersonas: readonly string[] | undefined,
  commandPersonas: readonly string[],
): string[] {
  if (!routePersonas) return uniqueStrings(commandPersonas);

  const routePersonaSet = new Set(routePersonas);
  const sharedPersonas = commandPersonas.filter((persona) => routePersonaSet.has(persona));
  return sharedPersonas.length > 0 ? uniqueStrings(sharedPersonas) : [''];
}

function validatePackActivation(
  extension: CockpitExtensionManifest,
  activePacks: ReadonlySet<string>,
  addProblem: (problem: CockpitExtensionRegistryProblem) => void,
) {
  void activePacks;
  if (extension.packIds.length > 0) return;
  addProblem({
    code: 'missing-pack-activation',
    message: `Extension "${extension.id}" must declare at least one pack activation key.`,
    extensionId: extension.id,
  });
}

function validateRoutes(
  extension: CockpitExtensionManifest,
  routeIds: Map<string, string>,
  routePaths: Map<string, string>,
  routeLoaders: Readonly<Record<string, CockpitExtensionRouteModuleLoader | undefined>>,
  addProblem: (problem: CockpitExtensionRegistryProblem) => void,
) {
  const permissionGrants = getPermissionGrantIds(extension);
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
    validatePermissionGrantReferences(extension, route.id, route.permissionGrantIds, addProblem);
    validatePermissionGuardCoverage(
      extension,
      route.id,
      route.permissionGrantIds,
      route.guard,
      permissionGrants,
      addProblem,
    );
    const invalidPathReason = getInvalidExternalPathReason(route.path);
    if (invalidPathReason) {
      addProblem({
        code: 'invalid-external-path',
        message: `Route "${route.id}" must live under the /external/ path boundary: ${invalidPathReason}.`,
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
    validateGuard(extension.id, route.id, route.guard, addProblem);
  }
}

function validateNavItems(
  extension: CockpitExtensionManifest,
  localRoutes: ReadonlyMap<string, CockpitExtensionRouteRef>,
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
    const route = localRoutes.get(item.routeId);
    if (!route) {
      addProblem({
        code: 'missing-route',
        message: `Nav item "${item.id}" references missing route "${item.routeId}".`,
        extensionId: extension.id,
        itemId: item.id,
      });
    }
    const invalidTargetReason = getInvalidExternalPathReason(item.to);
    if (invalidTargetReason || item.to.includes('$') || (route && item.to !== route.path)) {
      addProblem({
        code: 'invalid-direct-nav-target',
        message: `Nav item "${item.id}" must target its referenced non-parameterized external route path.`,
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
  localRoutes: ReadonlyMap<string, CockpitExtensionRouteRef>,
  commandIds: Map<string, string>,
  shortcutIds: Map<string, string>,
  addProblem: (problem: CockpitExtensionRegistryProblem) => void,
) {
  const permissionGrants = getPermissionGrantIds(extension);
  for (const command of extension.commands) {
    addDuplicateProblem(commandIds, command.id, extension.id, 'command id', {
      code: 'duplicate-command-id',
      extensionId: extension.id,
      itemId: command.id,
      addProblem,
    });
    if (command.routeId && !localRoutes.has(command.routeId)) {
      addProblem({
        code: 'missing-route',
        message: `Command "${command.id}" references missing route "${command.routeId}".`,
        extensionId: extension.id,
        itemId: command.id,
      });
    }
    if (!command.guard || command.guard.personas.length === 0) {
      addProblem({
        code: 'missing-command-guard',
        message: `Command "${command.id}" must declare host-owned guard metadata.`,
        extensionId: extension.id,
        itemId: command.id,
      });
    } else {
      validateGuard(extension.id, command.id, command.guard, addProblem);
      validatePermissionGrantReferences(
        extension,
        command.id,
        command.permissionGrantIds,
        addProblem,
      );
      validatePermissionGuardCoverage(
        extension,
        command.id,
        command.permissionGrantIds,
        {
          ...command.guard,
          requiredCapabilities: uniqueStrings([
            ...command.guard.requiredCapabilities,
            ...(command.requiredCapabilities ?? []),
          ]),
          requiredApiScopes: uniqueStrings([
            ...command.guard.requiredApiScopes,
            ...(command.requiredApiScopes ?? []),
          ]),
        },
        permissionGrants,
        addProblem,
      );
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

function validateDataScopes(
  extension: CockpitExtensionManifest,
  dataScopeIds: Map<string, string>,
  addProblem: (problem: CockpitExtensionRegistryProblem) => void,
) {
  const permissionGrants = getPermissionGrantIds(extension);
  for (const scope of extension.dataScopes ?? []) {
    addDuplicateProblem(dataScopeIds, scope.id, extension.id, 'data scope id', {
      code: 'duplicate-data-scope-id',
      extensionId: extension.id,
      itemId: scope.id,
      addProblem,
    });

    if (scope.access !== 'read') {
      addProblem({
        code: 'invalid-data-scope-access',
        message: `Data scope "${scope.id}" must be read-only.`,
        extensionId: extension.id,
        itemId: scope.id,
      });
    }

    validateGuard(extension.id, scope.id, scope.guard, addProblem);
    validatePermissionGrantReferences(extension, scope.id, scope.permissionGrantIds, addProblem);
    validatePermissionGuardCoverage(
      extension,
      scope.id,
      scope.permissionGrantIds,
      scope.guard,
      permissionGrants,
      addProblem,
    );

    for (const grantId of scope.permissionGrantIds) {
      const grant = permissionGrants.get(grantId);
      if (
        grant &&
        (grant.kind !== 'data-query' ||
          grant.policySemantics !== 'authorization-required' ||
          grant.evidenceSemantics !== 'read-audited-by-control-plane')
      ) {
        addProblem({
          code: 'invalid-data-scope-permission',
          message: `Data scope "${scope.id}" must reference read-only data-query permission grants.`,
          extensionId: extension.id,
          itemId: scope.id,
        });
      }
    }
  }
}

function validateWidgets(
  extension: CockpitExtensionManifest,
  localRoutes: ReadonlyMap<string, CockpitExtensionRouteRef>,
  widgetIds: Map<string, string>,
  addProblem: (problem: CockpitExtensionRegistryProblem) => void,
) {
  const permissionGrants = getPermissionGrantIds(extension);
  const dataScopeIds = new Set((extension.dataScopes ?? []).map((scope) => scope.id));

  for (const widget of extension.widgets ?? []) {
    addDuplicateProblem(widgetIds, widget.id, extension.id, 'widget id', {
      code: 'duplicate-widget-id',
      extensionId: extension.id,
      itemId: widget.id,
      addProblem,
    });

    if (!allowedWidgetSurfaces.has(widget.surface)) {
      addProblem({
        code: 'invalid-widget-surface',
        message: `Widget "${widget.id}" uses unsupported surface "${widget.surface}".`,
        extensionId: extension.id,
        itemId: widget.id,
      });
    }

    if (widget.routeId && !localRoutes.has(widget.routeId)) {
      addProblem({
        code: 'missing-route',
        message: `Widget "${widget.id}" references missing route "${widget.routeId}".`,
        extensionId: extension.id,
        itemId: widget.id,
      });
    }

    for (const dataScopeId of widget.dataScopeIds ?? []) {
      if (!dataScopeIds.has(dataScopeId)) {
        addProblem({
          code: 'missing-data-scope',
          message: `Widget "${widget.id}" references missing data scope "${dataScopeId}".`,
          extensionId: extension.id,
          itemId: widget.id,
        });
      }
    }

    validateGuard(extension.id, widget.id, widget.guard, addProblem);
    validatePermissionGrantReferences(extension, widget.id, widget.permissionGrantIds, addProblem);
    validatePermissionGuardCoverage(
      extension,
      widget.id,
      widget.permissionGrantIds,
      widget.guard,
      permissionGrants,
      addProblem,
    );
  }
}

function validateGovernanceControls(
  extension: CockpitExtensionManifest,
  addProblem: (problem: CockpitExtensionRegistryProblem) => void,
) {
  const governance = extension.governance;
  if (!governance) {
    addProblem({
      code: 'missing-governance-controls',
      message: `Extension "${extension.id}" must declare identity, version pinning, permissions, lifecycle controls, and audit events.`,
      extensionId: extension.id,
    });
    return;
  }

  if (
    !governance.identity.publisher.trim() ||
    !governance.identity.attestation.subject.trim() ||
    !/^[a-f0-9]{64}$/i.test(governance.identity.attestation.digestSha256)
  ) {
    addProblem({
      code: 'invalid-governance-control',
      message: `Extension "${extension.id}" must declare audit-ready identity attestation metadata.`,
      extensionId: extension.id,
    });
  }

  if (
    !governance.versionPin.packageName.trim() ||
    !governance.versionPin.version.trim() ||
    governance.permissions.length === 0
  ) {
    addProblem({
      code: 'invalid-governance-control',
      message: `Extension "${extension.id}" must declare a pinned package version and at least one permission grant.`,
      extensionId: extension.id,
    });
  }

  if (
    governance.lifecycle.emergencyDisable.mode !== 'activation-source' ||
    !governance.lifecycle.emergencyDisable.suppresses.includes('routes') ||
    !governance.lifecycle.emergencyDisable.suppresses.includes('navigation') ||
    !governance.lifecycle.emergencyDisable.suppresses.includes('commands') ||
    !governance.lifecycle.emergencyDisable.suppresses.includes('data-loading') ||
    !governance.lifecycle.auditEvents.includes('emergency-disable')
  ) {
    addProblem({
      code: 'invalid-governance-control',
      message: `Extension "${extension.id}" emergency disable must suppress every executable surface and be auditable.`,
      extensionId: extension.id,
    });
  }

  for (const grantId of duplicateValues(governance.permissions.map((grant) => grant.id))) {
    addProblem({
      code: 'duplicate-permission-grant',
      message: `Extension "${extension.id}" declares duplicate permission grant "${grantId}".`,
      extensionId: extension.id,
      itemId: grantId,
    });
  }
}

function getPermissionGrantIds(
  extension: CockpitExtensionManifest,
): ReadonlyMap<string, NonNullable<CockpitExtensionManifest['governance']>['permissions'][number]> {
  return new Map(extension.governance?.permissions.map((grant) => [grant.id, grant]) ?? []);
}

function validatePermissionGrantReferences(
  extension: CockpitExtensionManifest,
  itemId: string,
  permissionGrantIds: readonly string[] | undefined,
  addProblem: (problem: CockpitExtensionRegistryProblem) => void,
) {
  if (!permissionGrantIds || permissionGrantIds.length === 0) {
    addProblem({
      code: 'undeclared-permission-grant',
      message: `Item "${itemId}" must reference at least one declared permission grant.`,
      extensionId: extension.id,
      itemId,
    });
    return;
  }

  const grants = getPermissionGrantIds(extension);
  for (const grantId of permissionGrantIds) {
    if (!grants.has(grantId)) {
      addProblem({
        code: 'undeclared-permission-grant',
        message: `Item "${itemId}" references undeclared permission grant "${grantId}".`,
        extensionId: extension.id,
        itemId,
      });
    }
  }
}

function validatePermissionGuardCoverage(
  extension: CockpitExtensionManifest,
  itemId: string,
  permissionGrantIds: readonly string[] | undefined,
  guard: { requiredCapabilities: readonly string[]; requiredApiScopes: readonly string[] },
  grants: ReadonlyMap<
    string,
    NonNullable<CockpitExtensionManifest['governance']>['permissions'][number]
  >,
  addProblem: (problem: CockpitExtensionRegistryProblem) => void,
) {
  if (!permissionGrantIds) return;
  const grantRequirements = permissionGrantIds.flatMap((grantId) => {
    const grant = grants.get(grantId);
    return grant
      ? [
          ...grant.requiredCapabilities.map((requirement) => ({
            kind: 'capability' as const,
            value: requirement,
          })),
          ...grant.requiredApiScopes.map((requirement) => ({
            kind: 'api-scope' as const,
            value: requirement,
          })),
        ]
      : [];
  });
  const guardCapabilities = new Set(guard.requiredCapabilities);
  const guardApiScopes = new Set(guard.requiredApiScopes);
  const uncovered = grantRequirements.filter((requirement) =>
    requirement.kind === 'capability'
      ? !guardCapabilities.has(requirement.value)
      : !guardApiScopes.has(requirement.value),
  );

  if (uncovered.length > 0) {
    addProblem({
      code: 'permission-bypass-risk',
      message: `Item "${itemId}" guard is weaker than its declared permission grants: ${uncovered.map((requirement) => requirement.value).join(', ')}.`,
      extensionId: extension.id,
      itemId,
    });
  }
}

function validateGuard(
  extensionId: string,
  itemId: string,
  guard: {
    personas: readonly string[];
    privacyClasses?: readonly string[];
  },
  addProblem: (problem: CockpitExtensionRegistryProblem) => void,
) {
  validatePersonas(extensionId, itemId, guard.personas, addProblem);

  for (const privacyClass of guard.privacyClasses ?? []) {
    if (!allowedPrivacyClasses.has(privacyClass)) {
      addProblem({
        code: 'invalid-privacy-class',
        message: `Item "${itemId}" uses unsupported privacy class "${privacyClass}".`,
        extensionId,
        itemId,
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

function getInvalidExternalPathReason(path: string): string | null {
  if (!path.startsWith('/external/')) {
    return 'path must start with /external/';
  }
  if (path.includes('?') || path.includes('#')) {
    return 'path must not include query or hash fragments';
  }
  if (/[\u0000-\u001f\u007f]/.test(path)) {
    return 'path must not include control characters';
  }
  if (path.includes('//')) {
    return 'path must not include duplicate slashes';
  }

  for (const segment of path.split('/').filter(Boolean)) {
    const decoded = decodeExternalPathSegment(segment);
    if (!decoded) {
      return 'path segments must be valid, non-ambiguous URI segments';
    }
    if (decoded === '.' || decoded === '..') {
      return 'path must not include dot segments';
    }
    if (decoded.includes('/') || decoded.includes('\\')) {
      return 'path must not include encoded slash or backslash characters';
    }
    if (/[\u0000-\u001f\u007f]/.test(decoded)) {
      return 'path must not include encoded control characters';
    }
  }

  return null;
}

function decodeExternalPathSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
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
