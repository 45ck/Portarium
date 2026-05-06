import {
  COCKPIT_EXTENSION_ICONS,
  COCKPIT_EXTENSION_MANIFEST_VERSION,
  COCKPIT_EXTENSION_PERSONAS,
  COCKPIT_EXTENSION_PRIVACY_CLASSES,
  COCKPIT_EXTENSION_SURFACES,
  COCKPIT_EXTENSION_WIDGET_SURFACES,
  type CockpitExtensionGuard,
  type CockpitExtensionManifestV1,
  type CockpitExtensionPackageRef,
  type CockpitExtensionRegistryProblem,
  type CockpitWorkspacePackActivationRef,
} from './manifest-v1.js';

export interface CockpitExtensionRouteProjectionV1 {
  extensionId: string;
  routeId: string;
  path: string;
}

export interface CockpitExtensionManifestConformanceInput {
  manifest: CockpitExtensionManifestV1;
  packageRef?: CockpitExtensionPackageRef;
  workspacePackRefs?: readonly CockpitWorkspacePackActivationRef[];
  routeModuleIds?: readonly string[];
}

export interface CockpitExtensionManifestConformanceReport {
  conforms: boolean;
  problems: readonly CockpitExtensionRegistryProblem[];
  routeProjection: readonly CockpitExtensionRouteProjectionV1[];
}

export class CockpitExtensionManifestConformanceError extends Error {
  public readonly report: CockpitExtensionManifestConformanceReport;

  constructor(report: CockpitExtensionManifestConformanceReport) {
    super(
      `Cockpit extension manifest conformance failed: ${report.problems
        .map((problem) => problem.code)
        .join(', ')}`,
    );
    this.name = 'CockpitExtensionManifestConformanceError';
    this.report = report;
  }
}

const allowedSurfaces = new Set<string>(COCKPIT_EXTENSION_SURFACES);
const allowedPersonas = new Set<string>(COCKPIT_EXTENSION_PERSONAS);
const allowedPrivacyClasses = new Set<string>(COCKPIT_EXTENSION_PRIVACY_CLASSES);
const allowedIcons = new Set<string>(COCKPIT_EXTENSION_ICONS);
const allowedWidgetSurfaces = new Set<string>(COCKPIT_EXTENSION_WIDGET_SURFACES);
const forbiddenManifestKeys = new Set([
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

export function createCockpitExtensionManifestV1ConformanceReport({
  manifest,
  packageRef,
  workspacePackRefs,
  routeModuleIds,
}: CockpitExtensionManifestConformanceInput): CockpitExtensionManifestConformanceReport {
  const routeIds = routeModuleIds ?? manifest.routes.map((route) => route.id);
  const problems = [
    ...validateManifest(manifest, routeIds),
    ...validateInstallBoundary(manifest, packageRef, workspacePackRefs, routeIds),
  ];
  const routeProjection = problems.length === 0 ? createRouteProjection(manifest) : [];

  return {
    conforms: problems.length === 0,
    problems,
    routeProjection,
  };
}

export function assertCockpitExtensionManifestV1Conforms(
  input: CockpitExtensionManifestConformanceInput,
): CockpitExtensionManifestConformanceReport {
  const report = createCockpitExtensionManifestV1ConformanceReport(input);
  if (!report.conforms) {
    throw new CockpitExtensionManifestConformanceError(report);
  }
  return report;
}

function validateManifest(
  manifest: CockpitExtensionManifestV1,
  routeModuleIds: readonly string[],
): CockpitExtensionRegistryProblem[] {
  const problems: CockpitExtensionRegistryProblem[] = [];
  const extensionId = manifest.id;

  if (manifest.manifestVersion !== COCKPIT_EXTENSION_MANIFEST_VERSION) {
    problems.push({
      code: 'invalid-manifest-version',
      message: `Extension "${extensionId}" must use Cockpit extension manifest version 1.`,
      extensionId,
    });
  }

  for (const forbiddenKeyPath of findForbiddenManifestKeys(manifest)) {
    problems.push({
      code: 'forbidden-manifest-key',
      message: `Extension "${extensionId}" manifest must not declare executable or egress field "${forbiddenKeyPath}".`,
      extensionId,
      itemId: forbiddenKeyPath,
    });
  }

  validateGovernanceControls(manifest, problems);
  validatePersonas(extensionId, extensionId, manifest.personas, problems);
  validatePackActivation(manifest, problems);
  validateRoutes(manifest, routeModuleIds, problems);
  validateNavItems(manifest, problems);
  validateCommands(manifest, problems);
  validateShellContributions(manifest, problems);
  validateDataScopes(manifest, problems);
  validateWidgets(manifest, problems);

  return problems;
}

function validateInstallBoundary(
  manifest: CockpitExtensionManifestV1,
  packageRef: CockpitExtensionPackageRef | undefined,
  workspacePackRefs: readonly CockpitWorkspacePackActivationRef[] | undefined,
  routeModuleIds: readonly string[],
): CockpitExtensionRegistryProblem[] {
  const problems: CockpitExtensionRegistryProblem[] = [];
  const extensionId = manifest.id;

  if (packageRef) {
    if (!packageRef.packageName.trim()) {
      problems.push({
        code: 'missing-package-ref',
        message: `Installed extension "${extensionId}" must declare a host-reviewed package reference.`,
        extensionId,
      });
    }
    if (
      manifest.governance.versionPin.packageName !== packageRef.packageName ||
      manifest.governance.versionPin.version !== packageRef.version
    ) {
      problems.push({
        code: 'governance-package-ref-mismatch',
        message: `Installed extension "${extensionId}" governance version pin must match its host-reviewed package reference.`,
        extensionId,
        itemId: manifest.governance.versionPin.packageName,
      });
    }
  }

  if (workspacePackRefs) {
    const workspacePackIds = workspacePackRefs.map((ref) => ref.packId);
    for (const packId of symmetricDifference(manifest.packIds, workspacePackIds)) {
      problems.push({
        code: 'install-pack-ref-mismatch',
        message: `Installed extension "${extensionId}" workspace pack ref "${packId}" must match its manifest pack IDs.`,
        extensionId,
        itemId: packId,
      });
    }
  }

  for (const routeId of duplicateValues(routeModuleIds)) {
    problems.push({
      code: 'duplicate-route-module',
      message: `Installed extension "${extensionId}" declares duplicate route module "${routeId}".`,
      extensionId,
      itemId: routeId,
    });
  }

  return problems;
}

function validatePackActivation(
  manifest: CockpitExtensionManifestV1,
  problems: CockpitExtensionRegistryProblem[],
) {
  if (manifest.packIds.length > 0) return;
  problems.push({
    code: 'missing-pack-activation',
    message: `Extension "${manifest.id}" must declare at least one pack activation key.`,
    extensionId: manifest.id,
  });
}

function validateRoutes(
  manifest: CockpitExtensionManifestV1,
  routeModuleIds: readonly string[],
  problems: CockpitExtensionRegistryProblem[],
) {
  const routeIds = new Map<string, string>();
  const routePaths = new Map<string, string>();
  const moduleIds = new Set(routeModuleIds);
  const manifestRouteIds = new Set(manifest.routes.map((route) => route.id));

  for (const routeId of routeModuleIds.filter((routeId) => !manifestRouteIds.has(routeId))) {
    problems.push({
      code: 'undeclared-route-module',
      message: `Route module "${routeId}" is installed but no extension manifest declares it.`,
      extensionId: manifest.id,
      itemId: routeId,
    });
  }

  for (const route of manifest.routes) {
    addDuplicateProblem(routeIds, route.id, manifest.id, 'route id', {
      code: 'duplicate-route-id',
      extensionId: manifest.id,
      itemId: route.id,
      problems,
    });
    addDuplicateProblem(routePaths, route.path, manifest.id, 'route path', {
      code: 'duplicate-route-path',
      extensionId: manifest.id,
      itemId: route.id,
      problems,
    });
    if (!route.guard || route.guard.personas.length === 0) {
      problems.push({
        code: 'missing-route-guard',
        message: `Route "${route.id}" must declare host-owned guard metadata.`,
        extensionId: manifest.id,
        itemId: route.id,
      });
      continue;
    }
    validatePermissionGrantReferences(manifest, route.id, route.permissionGrantIds, problems);
    validatePermissionGuardCoverage(
      manifest,
      route.id,
      route.permissionGrantIds,
      route.guard,
      problems,
    );
    const invalidPathReason = getInvalidExternalPathReason(route.path);
    if (invalidPathReason) {
      problems.push({
        code: 'invalid-external-path',
        message: `Route "${route.id}" must live under the /external/ path boundary: ${invalidPathReason}.`,
        extensionId: manifest.id,
        itemId: route.id,
      });
    }
    if (!moduleIds.has(route.id)) {
      problems.push({
        code: 'missing-route-module',
        message: `Route "${route.id}" must have a compile-time route module loader before the extension can be enabled.`,
        extensionId: manifest.id,
        itemId: route.id,
      });
    }
    validateGuard(manifest.id, route.id, route.guard, problems);
  }
}

function validateNavItems(
  manifest: CockpitExtensionManifestV1,
  problems: CockpitExtensionRegistryProblem[],
) {
  const navIds = new Map<string, string>();
  const localRoutes = new Map(manifest.routes.map((route) => [route.id, route]));

  for (const item of manifest.navItems) {
    addDuplicateProblem(navIds, item.id, manifest.id, 'nav id', {
      code: 'duplicate-nav-id',
      extensionId: manifest.id,
      itemId: item.id,
      problems,
    });
    const route = localRoutes.get(item.routeId);
    if (!route) {
      problems.push({
        code: 'missing-route',
        message: `Nav item "${item.id}" references missing route "${item.routeId}".`,
        extensionId: manifest.id,
        itemId: item.id,
      });
    }
    const invalidTargetReason = getInvalidExternalPathReason(item.to);
    if (invalidTargetReason || item.to.includes('$') || (route && item.to !== route.path)) {
      problems.push({
        code: 'invalid-direct-nav-target',
        message: `Nav item "${item.id}" must target its referenced non-parameterized external route path.`,
        extensionId: manifest.id,
        itemId: item.id,
      });
    }
    if (!allowedIcons.has(item.icon)) {
      problems.push({
        code: 'invalid-icon',
        message: `Nav item "${item.id}" uses unsupported icon "${item.icon}".`,
        extensionId: manifest.id,
        itemId: item.id,
      });
    }
    for (const surface of item.surfaces) {
      if (!allowedSurfaces.has(surface)) {
        problems.push({
          code: 'invalid-surface',
          message: `Nav item "${item.id}" uses unsupported surface "${surface}".`,
          extensionId: manifest.id,
          itemId: item.id,
        });
      }
    }
    validatePersonas(manifest.id, item.id, item.personas, problems);
  }
}

function validateCommands(
  manifest: CockpitExtensionManifestV1,
  problems: CockpitExtensionRegistryProblem[],
) {
  const commandIds = new Map<string, string>();
  const shortcutIds = new Map<string, string>();
  const localRoutes = new Map(manifest.routes.map((route) => [route.id, route]));

  for (const command of manifest.commands) {
    addDuplicateProblem(commandIds, command.id, manifest.id, 'command id', {
      code: 'duplicate-command-id',
      extensionId: manifest.id,
      itemId: command.id,
      problems,
    });
    if (command.routeId && !localRoutes.has(command.routeId)) {
      problems.push({
        code: 'missing-route',
        message: `Command "${command.id}" references missing route "${command.routeId}".`,
        extensionId: manifest.id,
        itemId: command.id,
      });
    }
    if (!command.guard || command.guard.personas.length === 0) {
      problems.push({
        code: 'missing-command-guard',
        message: `Command "${command.id}" must declare host-owned guard metadata.`,
        extensionId: manifest.id,
        itemId: command.id,
      });
    } else {
      validateGuard(manifest.id, command.id, command.guard, problems);
      validatePermissionGrantReferences(manifest, command.id, command.permissionGrantIds, problems);
      validatePermissionGuardCoverage(
        manifest,
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
        problems,
      );
    }
    if (command.shortcut) {
      addDuplicateProblem(shortcutIds, command.shortcut, manifest.id, 'shortcut', {
        code: 'duplicate-shortcut',
        extensionId: manifest.id,
        itemId: command.id,
        problems,
      });
    }
  }
}

function validateShellContributions(
  manifest: CockpitExtensionManifestV1,
  problems: CockpitExtensionRegistryProblem[],
) {
  const modeIds = new Map<string, string>();
  const routeIds = new Set(manifest.routes.map((route) => route.id));
  const navItemIds = new Set(manifest.navItems.map((item) => item.id));
  const validVisibility = new Set(['visible', 'advanced', 'hidden']);

  for (const mode of manifest.shellContributions?.modes ?? []) {
    if (mode.modeId.trim().length === 0) {
      problems.push({
        code: 'invalid-shell-contribution',
        message: `Extension "${manifest.id}" shell mode must declare a non-empty mode id.`,
        extensionId: manifest.id,
      });
      continue;
    }

    addDuplicateProblem(modeIds, mode.modeId, manifest.id, 'shell mode id', {
      code: 'duplicate-shell-mode',
      extensionId: manifest.id,
      itemId: mode.modeId,
      problems,
    });

    if (mode.defaultRoute && !routeIds.has(mode.defaultRoute.routeId)) {
      problems.push({
        code: 'invalid-shell-contribution',
        message: `Shell mode "${mode.modeId}" default route references missing route "${mode.defaultRoute.routeId}".`,
        extensionId: manifest.id,
        itemId: mode.modeId,
      });
    }

    for (const navItem of mode.extensionNav ?? []) {
      if (!navItemIds.has(navItem.navItemId)) {
        problems.push({
          code: 'invalid-shell-contribution',
          message: `Shell mode "${mode.modeId}" references missing nav item "${navItem.navItemId}".`,
          extensionId: manifest.id,
          itemId: mode.modeId,
        });
      }
      validateOptionalOrder(manifest.id, mode.modeId, navItem.order, problems);
    }

    for (const section of mode.coreSections ?? []) {
      if (section.visibility && !validVisibility.has(section.visibility)) {
        problems.push({
          code: 'invalid-shell-contribution',
          message: `Shell mode "${mode.modeId}" uses unsupported core section visibility "${section.visibility}".`,
          extensionId: manifest.id,
          itemId: mode.modeId,
        });
      }
      validateOptionalOrder(manifest.id, mode.modeId, section.order, problems);
    }

    for (const item of mode.coreItems ?? []) {
      if (item.visibility && !validVisibility.has(item.visibility)) {
        problems.push({
          code: 'invalid-shell-contribution',
          message: `Shell mode "${mode.modeId}" uses unsupported core item visibility "${item.visibility}".`,
          extensionId: manifest.id,
          itemId: mode.modeId,
        });
      }
      validateOptionalOrder(manifest.id, mode.modeId, item.order, problems);
    }

    for (const itemId of mode.mobilePrimaryCoreItemIds ?? []) {
      if (typeof itemId !== 'string' || itemId.trim().length === 0) {
        problems.push({
          code: 'invalid-shell-contribution',
          message: `Shell mode "${mode.modeId}" mobile primary core item ids must be non-empty strings.`,
          extensionId: manifest.id,
          itemId: mode.modeId,
        });
      }
    }

    for (const action of mode.globalActions ?? []) {
      if (typeof action.actionId !== 'string' || action.actionId.trim().length === 0) {
        problems.push({
          code: 'invalid-shell-contribution',
          message: `Shell mode "${mode.modeId}" global action ids must be non-empty strings.`,
          extensionId: manifest.id,
          itemId: mode.modeId,
        });
      }
      if (action.visibility && action.visibility !== 'visible' && action.visibility !== 'hidden') {
        problems.push({
          code: 'invalid-shell-contribution',
          message: `Shell mode "${mode.modeId}" uses unsupported global action visibility "${action.visibility}".`,
          extensionId: manifest.id,
          itemId: mode.modeId,
        });
      }
    }

    validateOptionalOrder(manifest.id, mode.modeId, mode.priority, problems);
  }
}

function validateOptionalOrder(
  extensionId: string,
  itemId: string,
  value: number | undefined,
  problems: CockpitExtensionRegistryProblem[],
) {
  if (value === undefined || Number.isFinite(value)) {
    return;
  }

  problems.push({
    code: 'invalid-shell-contribution',
    message: `Shell mode "${itemId}" order and priority values must be finite numbers.`,
    extensionId,
    itemId,
  });
}

function validateDataScopes(
  manifest: CockpitExtensionManifestV1,
  problems: CockpitExtensionRegistryProblem[],
) {
  const scopeIds = new Map<string, string>();

  for (const scope of manifest.dataScopes ?? []) {
    addDuplicateProblem(scopeIds, scope.id, manifest.id, 'data scope id', {
      code: 'duplicate-data-scope-id',
      extensionId: manifest.id,
      itemId: scope.id,
      problems,
    });
    if (scope.access !== 'read') {
      problems.push({
        code: 'invalid-data-scope-access',
        message: `Data scope "${scope.id}" must declare read-only access.`,
        extensionId: manifest.id,
        itemId: scope.id,
      });
    }
    if (!scope.guard || scope.guard.personas.length === 0) {
      problems.push({
        code: 'missing-route-guard',
        message: `Data scope "${scope.id}" must declare host-owned guard metadata.`,
        extensionId: manifest.id,
        itemId: scope.id,
      });
      continue;
    }
    validateGuard(manifest.id, scope.id, scope.guard, problems);
    validatePermissionGrantReferences(manifest, scope.id, scope.permissionGrantIds, problems);
    validatePermissionGuardCoverage(
      manifest,
      scope.id,
      scope.permissionGrantIds,
      scope.guard,
      problems,
    );
    validateReadOnlyPermissionGrants(manifest, scope.id, scope.permissionGrantIds, problems);
  }
}

function validateWidgets(
  manifest: CockpitExtensionManifestV1,
  problems: CockpitExtensionRegistryProblem[],
) {
  const widgetIds = new Map<string, string>();
  const localRoutes = new Set(manifest.routes.map((route) => route.id));
  const dataScopeIds = new Set((manifest.dataScopes ?? []).map((scope) => scope.id));

  for (const widget of manifest.widgets ?? []) {
    addDuplicateProblem(widgetIds, widget.id, manifest.id, 'widget id', {
      code: 'duplicate-widget-id',
      extensionId: manifest.id,
      itemId: widget.id,
      problems,
    });
    if (!allowedWidgetSurfaces.has(widget.surface)) {
      problems.push({
        code: 'invalid-widget-surface',
        message: `Widget "${widget.id}" uses unsupported surface "${widget.surface}".`,
        extensionId: manifest.id,
        itemId: widget.id,
      });
    }
    if (widget.routeId && !localRoutes.has(widget.routeId)) {
      problems.push({
        code: 'missing-route',
        message: `Widget "${widget.id}" references missing route "${widget.routeId}".`,
        extensionId: manifest.id,
        itemId: widget.id,
      });
    }
    for (const dataScopeId of widget.dataScopeIds ?? []) {
      if (!dataScopeIds.has(dataScopeId)) {
        problems.push({
          code: 'missing-data-scope',
          message: `Widget "${widget.id}" references missing data scope "${dataScopeId}".`,
          extensionId: manifest.id,
          itemId: widget.id,
        });
      }
    }
    if (!widget.guard || widget.guard.personas.length === 0) {
      problems.push({
        code: 'missing-route-guard',
        message: `Widget "${widget.id}" must declare host-owned guard metadata.`,
        extensionId: manifest.id,
        itemId: widget.id,
      });
      continue;
    }
    validateGuard(manifest.id, widget.id, widget.guard, problems);
    validatePermissionGrantReferences(manifest, widget.id, widget.permissionGrantIds, problems);
    validatePermissionGuardCoverage(
      manifest,
      widget.id,
      widget.permissionGrantIds,
      widget.guard,
      problems,
    );
  }
}

function validateGovernanceControls(
  manifest: CockpitExtensionManifestV1,
  problems: CockpitExtensionRegistryProblem[],
) {
  const governance = manifest.governance;
  if (!governance) {
    problems.push({
      code: 'missing-governance-controls',
      message: `Extension "${manifest.id}" must declare identity, version pinning, permissions, lifecycle controls, and audit events.`,
      extensionId: manifest.id,
    });
    return;
  }

  if (
    !governance.identity.publisher.trim() ||
    !governance.identity.attestation.subject.trim() ||
    !/^[a-f0-9]{64}$/i.test(governance.identity.attestation.digestSha256)
  ) {
    problems.push({
      code: 'invalid-governance-control',
      message: `Extension "${manifest.id}" must declare audit-ready identity attestation metadata.`,
      extensionId: manifest.id,
    });
  }

  if (
    !governance.versionPin.packageName.trim() ||
    !governance.versionPin.version.trim() ||
    governance.permissions.length === 0
  ) {
    problems.push({
      code: 'invalid-governance-control',
      message: `Extension "${manifest.id}" must declare a pinned package version and at least one permission grant.`,
      extensionId: manifest.id,
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
    problems.push({
      code: 'invalid-governance-control',
      message: `Extension "${manifest.id}" emergency disable must suppress every executable surface and be auditable.`,
      extensionId: manifest.id,
    });
  }

  for (const grantId of duplicateValues(governance.permissions.map((grant) => grant.id))) {
    problems.push({
      code: 'duplicate-permission-grant',
      message: `Extension "${manifest.id}" declares duplicate permission grant "${grantId}".`,
      extensionId: manifest.id,
      itemId: grantId,
    });
  }
}

function validateReadOnlyPermissionGrants(
  manifest: CockpitExtensionManifestV1,
  itemId: string,
  permissionGrantIds: readonly string[] | undefined,
  problems: CockpitExtensionRegistryProblem[],
) {
  if (!permissionGrantIds) return;
  const grants = new Map(manifest.governance?.permissions.map((grant) => [grant.id, grant]) ?? []);
  for (const grantId of permissionGrantIds) {
    const grant = grants.get(grantId);
    if (!grant) continue;
    if (
      grant.kind !== 'data-query' ||
      grant.policySemantics !== 'authorization-required' ||
      grant.evidenceSemantics !== 'read-audited-by-control-plane'
    ) {
      problems.push({
        code: 'invalid-data-scope-permission',
        message: `Data scope "${itemId}" must reference read-only data-query permission grants.`,
        extensionId: manifest.id,
        itemId,
      });
    }
  }
}

function validatePermissionGrantReferences(
  manifest: CockpitExtensionManifestV1,
  itemId: string,
  permissionGrantIds: readonly string[] | undefined,
  problems: CockpitExtensionRegistryProblem[],
) {
  if (!permissionGrantIds || permissionGrantIds.length === 0) {
    problems.push({
      code: 'undeclared-permission-grant',
      message: `Item "${itemId}" must reference at least one declared permission grant.`,
      extensionId: manifest.id,
      itemId,
    });
    return;
  }

  const grants = new Set(manifest.governance?.permissions.map((grant) => grant.id) ?? []);
  for (const grantId of permissionGrantIds) {
    if (!grants.has(grantId)) {
      problems.push({
        code: 'undeclared-permission-grant',
        message: `Item "${itemId}" references undeclared permission grant "${grantId}".`,
        extensionId: manifest.id,
        itemId,
      });
    }
  }
}

function validatePermissionGuardCoverage(
  manifest: CockpitExtensionManifestV1,
  itemId: string,
  permissionGrantIds: readonly string[] | undefined,
  guard: Pick<CockpitExtensionGuard, 'requiredCapabilities' | 'requiredApiScopes'>,
  problems: CockpitExtensionRegistryProblem[],
) {
  if (!permissionGrantIds) return;
  const grants = new Map(manifest.governance?.permissions.map((grant) => [grant.id, grant]) ?? []);
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
    problems.push({
      code: 'permission-bypass-risk',
      message: `Item "${itemId}" guard is weaker than its declared permission grants: ${uncovered.map((requirement) => requirement.value).join(', ')}.`,
      extensionId: manifest.id,
      itemId,
    });
  }
}

function validateGuard(
  extensionId: string,
  itemId: string,
  guard: { personas: readonly string[]; privacyClasses?: readonly string[] },
  problems: CockpitExtensionRegistryProblem[],
) {
  validatePersonas(extensionId, itemId, guard.personas, problems);

  for (const privacyClass of guard.privacyClasses ?? []) {
    if (!allowedPrivacyClasses.has(privacyClass)) {
      problems.push({
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
  problems: CockpitExtensionRegistryProblem[],
) {
  for (const persona of personas) {
    if (!allowedPersonas.has(persona)) {
      problems.push({
        code: 'invalid-persona',
        message: `Item "${itemId}" uses unsupported persona "${persona}".`,
        extensionId,
        itemId,
      });
    }
  }
}

function createRouteProjection(
  manifest: CockpitExtensionManifestV1,
): readonly CockpitExtensionRouteProjectionV1[] {
  return manifest.routes
    .map((route) => ({
      extensionId: manifest.id,
      routeId: route.id,
      path: route.path,
    }))
    .sort(
      (left, right) =>
        left.path.localeCompare(right.path) || left.routeId.localeCompare(right.routeId),
    );
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

function findForbiddenManifestKeys(value: unknown, path = 'manifest'): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findForbiddenManifestKeys(item, `${path}[${index}]`));
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [
    ...(forbiddenManifestKeys.has(key) ? [`${path}.${key}`] : []),
    ...findForbiddenManifestKeys(child, `${path}.${key}`),
  ]);
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
    problems: CockpitExtensionRegistryProblem[];
  },
) {
  const existing = seen.get(value);
  if (existing) {
    options.problems.push({
      code: options.code,
      message: `Duplicate ${label} "${value}" from "${extensionId}" conflicts with "${existing}".`,
      extensionId: options.extensionId,
      itemId: options.itemId,
    });
    return;
  }
  seen.set(value, extensionId);
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

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}
