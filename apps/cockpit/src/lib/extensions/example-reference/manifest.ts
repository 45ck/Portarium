import type { CockpitExtensionManifest } from '../types';

const allPersonas = ['Operator', 'Approver', 'Auditor', 'Admin'] as const;

export const EXAMPLE_REFERENCE_EXTENSION = {
  manifestVersion: 1,
  id: 'example.reference',
  owner: 'portarium',
  version: '0.1.0',
  displayName: 'Reference Extension',
  description:
    'Neutral reference extension proving Cockpit can surface installed extension metadata without tenant-specific code in core.',
  packIds: ['example.reference'],
  personas: allPersonas,
  requiredCapabilities: ['extension:read', 'extension:review', 'evidence:read'],
  requiredApiScopes: ['extensions.read', 'approvals.read', 'evidence.read'],
  routes: [
    {
      id: 'example-reference-overview',
      path: '/external/example-reference/overview',
      title: 'Reference Overview',
      description: 'Reference route placeholder for an installed extension.',
      guard: {
        personas: allPersonas,
        requiredCapabilities: ['extension:read'],
        requiredApiScopes: ['extensions.read'],
        privacyClasses: ['internal'],
      },
    },
    {
      id: 'example-reference-review',
      path: '/external/example-reference/reviews/$proposalId',
      title: 'Reference Review',
      description: 'Reference review route placeholder using generic proposal metadata.',
      guard: {
        personas: allPersonas,
        requiredCapabilities: ['evidence:read'],
        requiredApiScopes: ['approvals.read', 'evidence.read'],
        privacyClasses: ['internal', 'restricted'],
      },
    },
  ],
  navItems: [
    {
      id: 'example-reference-overview-nav',
      title: 'Reference Overview',
      routeId: 'example-reference-overview',
      to: '/external/example-reference/overview',
      icon: 'plug',
      surfaces: ['sidebar', 'mobile-more', 'command'],
      personas: allPersonas,
      requiredCapabilities: ['extension:read'],
      requiredApiScopes: ['extensions.read'],
      mobilePrimary: true,
    },
  ],
  commands: [
    {
      id: 'example-reference-open-overview',
      title: 'Open reference extension',
      routeId: 'example-reference-overview',
      guard: {
        personas: allPersonas,
        requiredCapabilities: ['extension:read'],
        requiredApiScopes: ['extensions.read'],
        privacyClasses: ['internal'],
      },
      shortcut: 'G X',
    },
  ],
} as const satisfies CockpitExtensionManifest;
