export const COCKPIT_EXTENSION_MANIFEST_VERSION = 1 as const;

export const COCKPIT_EXTENSION_SURFACES = [
  'sidebar',
  'mobile-more',
  'command',
  'shortcut',
] as const;

export type CockpitExtensionSurface = (typeof COCKPIT_EXTENSION_SURFACES)[number];

export const COCKPIT_EXTENSION_PERSONAS = ['Operator', 'Approver', 'Auditor', 'Admin'] as const;

export type CockpitExtensionPersona = (typeof COCKPIT_EXTENSION_PERSONAS)[number];

export const COCKPIT_EXTENSION_ICONS = [
  'activity',
  'boxes',
  'clipboard-check',
  'external-link',
  'map',
  'plug',
  'route',
  'shield-check',
] as const;

export type CockpitExtensionIcon = (typeof COCKPIT_EXTENSION_ICONS)[number];

export type CockpitExtensionActivationState =
  | 'enabled'
  | 'disabled'
  | 'invalid'
  | 'quarantined'
  | 'emergency-disabled';

export type CockpitExtensionStatus = CockpitExtensionActivationState;

export type CockpitExtensionDisableReasonCode =
  | 'workspace-pack-inactive'
  | 'manually-disabled'
  | 'emergency-disabled'
  | 'missing-capability'
  | 'missing-api-scope'
  | 'host-policy'
  | 'dependency-unavailable'
  | 'install-mismatch'
  | 'invalid-manifest'
  | 'security-quarantine';

export interface CockpitExtensionDisableReason {
  code: CockpitExtensionDisableReasonCode;
  message: string;
  itemId?: string;
}

export interface CockpitWorkspacePackActivationRef {
  packId: string;
  workspaceId?: string;
}

export interface CockpitExtensionPackageRef {
  packageName: string;
  version?: string;
  workspacePath?: string;
}

export const COCKPIT_EXTENSION_PRIVACY_CLASSES = [
  'public',
  'internal',
  'restricted',
  'sensitive',
  'highly_restricted',
] as const;

export type CockpitExtensionPrivacyClass = (typeof COCKPIT_EXTENSION_PRIVACY_CLASSES)[number];

export interface CockpitExtensionGuard {
  personas: readonly CockpitExtensionPersona[];
  requiredCapabilities: readonly string[];
  requiredApiScopes: readonly string[];
  privacyClasses?: readonly CockpitExtensionPrivacyClass[];
}

export type CockpitExtensionPermissionKind = 'data-query' | 'command' | 'governed-action';

export type CockpitExtensionPolicySemantics =
  | 'authorization-required'
  | 'policy-approval-evidence-required';

export type CockpitExtensionEvidenceSemantics =
  | 'read-audited-by-control-plane'
  | 'evidence-required-before-response';

export interface CockpitExtensionPermissionGrant {
  id: string;
  kind: CockpitExtensionPermissionKind;
  title: string;
  requiredCapabilities: readonly string[];
  requiredApiScopes: readonly string[];
  policySemantics: CockpitExtensionPolicySemantics;
  evidenceSemantics: CockpitExtensionEvidenceSemantics;
  auditEventTypes: readonly string[];
}

export interface CockpitExtensionIdentityAttestation {
  kind: 'source-review' | 'signature' | 'build-provenance';
  subject: string;
  digestSha256: string;
  issuedAtIso?: string;
}

export interface CockpitExtensionVersionPin {
  packageName: string;
  version: string;
  sourceRef?: string;
  integritySha256?: string;
}

export interface CockpitExtensionLifecycleControls {
  emergencyDisable: {
    mode: 'activation-source';
    suppresses: readonly ('routes' | 'navigation' | 'commands' | 'shortcuts' | 'data-loading')[];
  };
  rollback: {
    mode: 'pinned-previous-version' | 'disable-only';
    targetVersion?: string;
  };
  auditEvents: readonly (
    | 'install'
    | 'enable'
    | 'disable'
    | 'emergency-disable'
    | 'upgrade'
    | 'rollback'
  )[];
}

export interface CockpitExtensionGovernance {
  identity: {
    publisher: string;
    attestation: CockpitExtensionIdentityAttestation;
  };
  versionPin: CockpitExtensionVersionPin;
  permissions: readonly CockpitExtensionPermissionGrant[];
  lifecycle: CockpitExtensionLifecycleControls;
}

export interface CockpitExtensionAccessContext {
  persona?: string;
  availablePersonas?: readonly string[];
  availableCapabilities?: readonly string[];
  availableApiScopes?: readonly string[];
  availablePrivacyClasses?: readonly string[];
}

export type CockpitExtensionAccessDenialCode =
  | 'persona'
  | 'missing-capability'
  | 'missing-api-scope'
  | 'missing-privacy-class'
  | 'route-unavailable';

export interface CockpitExtensionAccessDenial {
  code: CockpitExtensionAccessDenialCode;
  missing?: readonly string[];
}

export interface CockpitExtensionAccessDecision {
  allowed: boolean;
  denials: readonly CockpitExtensionAccessDenial[];
}

export interface CockpitExtensionRouteRef {
  id: string;
  path: string;
  title: string;
  description?: string;
  guard: CockpitExtensionGuard;
  permissionGrantIds: readonly string[];
}

export interface CockpitExtensionNavItem {
  id: string;
  title: string;
  routeId: string;
  to: string;
  icon: CockpitExtensionIcon;
  surfaces: readonly CockpitExtensionSurface[];
  personas: readonly CockpitExtensionPersona[];
  requiredCapabilities?: readonly string[];
  requiredApiScopes?: readonly string[];
  mobilePrimary?: boolean;
}

export interface CockpitExtensionCommand {
  id: string;
  title: string;
  routeId?: string;
  guard: CockpitExtensionGuard;
  permissionGrantIds: readonly string[];
  requiredCapabilities?: readonly string[];
  requiredApiScopes?: readonly string[];
  shortcut?: string;
}

export const COCKPIT_EXTENSION_WIDGET_SURFACES = [
  'dashboard',
  'route-panel',
  'detail-panel',
] as const;

export type CockpitExtensionWidgetSurface = (typeof COCKPIT_EXTENSION_WIDGET_SURFACES)[number];

export interface CockpitExtensionDataScopeRef {
  id: string;
  title: string;
  description?: string;
  resource: string;
  access: 'read';
  guard: CockpitExtensionGuard;
  permissionGrantIds: readonly string[];
}

export interface CockpitExtensionWidgetRef {
  id: string;
  title: string;
  description?: string;
  surface: CockpitExtensionWidgetSurface;
  routeId?: string;
  guard: CockpitExtensionGuard;
  permissionGrantIds: readonly string[];
  dataScopeIds?: readonly string[];
}

export interface CockpitExtensionManifestV1 {
  manifestVersion: typeof COCKPIT_EXTENSION_MANIFEST_VERSION;
  id: string;
  owner: string;
  version: string;
  displayName: string;
  description: string;
  packIds: readonly string[];
  personas: readonly CockpitExtensionPersona[];
  requiredCapabilities: readonly string[];
  requiredApiScopes: readonly string[];
  routes: readonly CockpitExtensionRouteRef[];
  navItems: readonly CockpitExtensionNavItem[];
  commands: readonly CockpitExtensionCommand[];
  widgets?: readonly CockpitExtensionWidgetRef[];
  dataScopes?: readonly CockpitExtensionDataScopeRef[];
  governance: CockpitExtensionGovernance;
}

export type CockpitExtensionManifest = CockpitExtensionManifestV1;

export interface CockpitExtensionRouteLoaderContext<
  TManifest extends CockpitExtensionManifestV1 = CockpitExtensionManifestV1,
> {
  manifest: TManifest;
  route: CockpitExtensionRouteRef;
  workspacePackRefs: readonly CockpitWorkspacePackActivationRef[];
  params?: Readonly<Record<string, string>>;
  pathname?: string;
  searchParams?: Readonly<Record<string, string | undefined>>;
  hash?: string;
}

export type CockpitExtensionRouteLoader<
  TData = unknown,
  TManifest extends CockpitExtensionManifestV1 = CockpitExtensionManifestV1,
> = (context: CockpitExtensionRouteLoaderContext<TManifest>) => TData | Promise<TData>;

export type CockpitExtensionRouteModuleLoader<TModule = unknown> = () => Promise<TModule>;

export interface CockpitExtensionRouteModuleRef<
  TModule = unknown,
  TData = unknown,
  TManifest extends CockpitExtensionManifestV1 = CockpitExtensionManifestV1,
> {
  routeId: string;
  loadModule: CockpitExtensionRouteModuleLoader<TModule>;
  loader?: CockpitExtensionRouteLoader<TData, TManifest>;
}

export interface CockpitInstalledExtension<
  TManifest extends CockpitExtensionManifestV1 = CockpitExtensionManifestV1,
  TRouteModuleRef extends CockpitExtensionRouteModuleRef<unknown, unknown, TManifest> =
    CockpitExtensionRouteModuleRef<unknown, unknown, TManifest>,
> {
  manifest: TManifest;
  routeModules: readonly TRouteModuleRef[];
  packageRef: CockpitExtensionPackageRef;
  workspacePackRefs: readonly CockpitWorkspacePackActivationRef[];
  state?: CockpitExtensionActivationState;
  disableReasons?: readonly CockpitExtensionDisableReason[];
}

export type InstalledCockpitExtension<
  TManifest extends CockpitExtensionManifestV1 = CockpitExtensionManifestV1,
  TRouteModuleRef extends CockpitExtensionRouteModuleRef<unknown, unknown, TManifest> =
    CockpitExtensionRouteModuleRef<unknown, unknown, TManifest>,
> = CockpitInstalledExtension<TManifest, TRouteModuleRef>;

export interface CockpitExtensionRegistryProblem {
  code:
    | 'duplicate-extension-id'
    | 'duplicate-route-id'
    | 'duplicate-route-path'
    | 'duplicate-nav-id'
    | 'duplicate-command-id'
    | 'duplicate-shortcut'
    | 'duplicate-widget-id'
    | 'duplicate-data-scope-id'
    | 'missing-route'
    | 'missing-data-scope'
    | 'invalid-surface'
    | 'invalid-widget-surface'
    | 'invalid-persona'
    | 'invalid-privacy-class'
    | 'invalid-icon'
    | 'invalid-data-scope-access'
    | 'invalid-data-scope-permission'
    | 'invalid-external-path'
    | 'invalid-direct-nav-target'
    | 'unknown-pack-activation'
    | 'missing-route-module'
    | 'undeclared-route-module'
    | 'duplicate-route-module'
    | 'missing-package-ref'
    | 'install-pack-ref-mismatch'
    | 'governance-package-ref-mismatch'
    | 'missing-governance-controls'
    | 'duplicate-permission-grant'
    | 'undeclared-permission-grant'
    | 'permission-bypass-risk'
    | 'invalid-governance-control'
    | 'missing-route-guard'
    | 'missing-command-guard'
    | 'missing-pack-activation'
    | 'invalid-manifest-version'
    | 'forbidden-manifest-key';
  message: string;
  extensionId?: string;
  itemId?: string;
}

export interface ResolvedCockpitExtension {
  manifest: CockpitExtensionManifestV1;
  status: CockpitExtensionStatus;
  routeModules?: readonly CockpitExtensionRouteModuleRef[];
  workspacePackRefs?: readonly CockpitWorkspacePackActivationRef[];
  disableReasons?: readonly CockpitExtensionDisableReason[];
  problems: readonly CockpitExtensionRegistryProblem[];
}

export interface ResolvedCockpitExtensionRegistry {
  extensions: readonly ResolvedCockpitExtension[];
  routes: readonly CockpitExtensionRouteRef[];
  navItems: readonly CockpitExtensionNavItem[];
  commands: readonly CockpitExtensionCommand[];
  widgets: readonly CockpitExtensionWidgetRef[];
  dataScopes: readonly CockpitExtensionDataScopeRef[];
  problems: readonly CockpitExtensionRegistryProblem[];
}
