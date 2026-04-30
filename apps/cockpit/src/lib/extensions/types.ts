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

export type CockpitExtensionActivationState = 'enabled' | 'disabled' | 'invalid' | 'quarantined';

export type CockpitExtensionStatus = CockpitExtensionActivationState;

export type CockpitExtensionDisableReasonCode =
  | 'workspace-pack-inactive'
  | 'manually-disabled'
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

export interface CockpitExtensionAccessContext {
  persona?: string;
  availablePersonas?: readonly string[];
  availableCapabilities?: readonly string[];
  availableApiScopes?: readonly string[];
}

export type CockpitExtensionAccessDenialCode =
  | 'persona'
  | 'missing-capability'
  | 'missing-api-scope';

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
  requiredCapabilities?: readonly string[];
  requiredApiScopes?: readonly string[];
  shortcut?: string;
}

export interface CockpitExtensionManifest {
  manifestVersion: 1;
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
}

export interface CockpitExtensionRouteLoaderContext<
  TManifest extends CockpitExtensionManifest = CockpitExtensionManifest,
> {
  manifest: TManifest;
  route: CockpitExtensionRouteRef;
  workspacePackRefs: readonly CockpitWorkspacePackActivationRef[];
}

export type CockpitExtensionRouteLoader<
  TData = unknown,
  TManifest extends CockpitExtensionManifest = CockpitExtensionManifest,
> = (context: CockpitExtensionRouteLoaderContext<TManifest>) => TData | Promise<TData>;

export type CockpitExtensionRouteModuleLoader<TModule = unknown> = () => Promise<TModule>;

export interface CockpitExtensionRouteModuleRef<
  TModule = unknown,
  TData = unknown,
  TManifest extends CockpitExtensionManifest = CockpitExtensionManifest,
> {
  routeId: string;
  /** Host-owned route module import; manifests declare routes but do not execute UI. */
  loadModule: CockpitExtensionRouteModuleLoader<TModule>;
  loader?: CockpitExtensionRouteLoader<TData, TManifest>;
}

export interface CockpitInstalledExtension<
  TManifest extends CockpitExtensionManifest = CockpitExtensionManifest,
  TRouteModuleRef extends CockpitExtensionRouteModuleRef<unknown, unknown, TManifest> =
    CockpitExtensionRouteModuleRef<unknown, unknown, TManifest>,
> {
  manifest: TManifest;
  routeModules: readonly TRouteModuleRef[];
  workspacePackRefs: readonly CockpitWorkspacePackActivationRef[];
  state?: CockpitExtensionActivationState;
  disableReasons?: readonly CockpitExtensionDisableReason[];
}

export type InstalledCockpitExtension<
  TManifest extends CockpitExtensionManifest = CockpitExtensionManifest,
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
    | 'missing-route'
    | 'invalid-surface'
    | 'invalid-persona'
    | 'invalid-privacy-class'
    | 'invalid-icon'
    | 'invalid-external-path'
    | 'invalid-direct-nav-target'
    | 'missing-route-module'
    | 'missing-route-guard'
    | 'missing-command-guard'
    | 'missing-pack-activation';
  message: string;
  extensionId?: string;
  itemId?: string;
}

export interface ResolvedCockpitExtension {
  manifest: CockpitExtensionManifest;
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
  problems: readonly CockpitExtensionRegistryProblem[];
}
