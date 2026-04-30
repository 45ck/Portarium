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

export type CockpitExtensionStatus = 'installed' | 'enabled' | 'disabled' | 'invalid';

export type CockpitExtensionPrivacyClass =
  | 'public'
  | 'internal'
  | 'restricted'
  | 'sensitive'
  | 'highly_restricted';

export interface CockpitExtensionGuard {
  personas: readonly CockpitExtensionPersona[];
  requiredCapabilities: readonly string[];
  requiredApiScopes: readonly string[];
  privacyClasses?: readonly CockpitExtensionPrivacyClass[];
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
  requiredCapabilities: readonly string[];
  requiredApiScopes: readonly string[];
  routes: readonly CockpitExtensionRouteRef[];
  navItems: readonly CockpitExtensionNavItem[];
  commands: readonly CockpitExtensionCommand[];
}

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
    | 'invalid-icon'
    | 'invalid-external-path'
    | 'invalid-direct-nav-target'
    | 'missing-route-guard'
    | 'missing-pack-activation';
  message: string;
  extensionId?: string;
  itemId?: string;
}

export interface ResolvedCockpitExtension {
  manifest: CockpitExtensionManifest;
  status: CockpitExtensionStatus;
  problems: readonly CockpitExtensionRegistryProblem[];
}

export interface ResolvedCockpitExtensionRegistry {
  extensions: readonly ResolvedCockpitExtension[];
  routes: readonly CockpitExtensionRouteRef[];
  navItems: readonly CockpitExtensionNavItem[];
  commands: readonly CockpitExtensionCommand[];
  problems: readonly CockpitExtensionRegistryProblem[];
}
