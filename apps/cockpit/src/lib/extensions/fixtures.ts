import type { CockpitExtensionManifest } from './types';

export const NEUTRAL_OPS_EXTENSION: CockpitExtensionManifest = {
  manifestVersion: 1,
  id: 'example.ops-demo',
  owner: 'portarium',
  version: '0.1.0',
  displayName: 'Operations Demo',
  description:
    'Neutral reference extension proving Cockpit can surface external vertical metadata without domain-specific code in core.',
  packIds: ['example.ops-demo'],
  requiredCapabilities: ['asset:read', 'incident:read', 'evidence:read'],
  requiredApiScopes: ['extensions.read', 'approvals.read', 'evidence.read'],
  routes: [
    {
      id: 'example-ops-overview',
      path: '/external/example-ops/overview',
      title: 'Operations Overview',
      description: 'Reference route placeholder for an externally installed vertical.',
      guard: {
        personas: ['Operator', 'Approver', 'Auditor', 'Admin'],
        requiredCapabilities: ['asset:read'],
        requiredApiScopes: ['extensions.read'],
        privacyClasses: ['internal'],
      },
    },
    {
      id: 'example-ops-action-review',
      path: '/external/example-ops/actions/$proposalId',
      title: 'Governed Action Review',
      description: 'Reference action-review route placeholder using generic proposal metadata.',
      guard: {
        personas: ['Operator', 'Approver', 'Auditor', 'Admin'],
        requiredCapabilities: ['evidence:read'],
        requiredApiScopes: ['approvals.read', 'evidence.read'],
        privacyClasses: ['internal', 'restricted'],
      },
    },
  ],
  navItems: [
    {
      id: 'example-ops-overview-nav',
      title: 'Operations Overview',
      routeId: 'example-ops-overview',
      to: '/external/example-ops/overview',
      icon: 'map',
      surfaces: ['sidebar', 'mobile-more', 'command'],
      personas: ['Operator', 'Approver', 'Auditor', 'Admin'],
      requiredCapabilities: ['asset:read'],
      requiredApiScopes: ['extensions.read'],
      mobilePrimary: true,
    },
  ],
  commands: [
    {
      id: 'example-ops-open-overview',
      title: 'Open operations demo',
      routeId: 'example-ops-overview',
      requiredCapabilities: ['asset:read'],
      requiredApiScopes: ['extensions.read'],
      shortcut: 'G X',
    },
  ],
};

export const COCKPIT_EXTENSION_FIXTURES: readonly CockpitExtensionManifest[] = [
  NEUTRAL_OPS_EXTENSION,
];
