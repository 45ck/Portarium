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
  requiredCapabilities: ['extension:read', 'extension:inspect'],
  requiredApiScopes: ['extensions.read', 'extensions.inspect'],
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
      id: 'example-reference-detail',
      path: '/external/example-reference/details/$itemId',
      title: 'Reference Detail',
      description: 'Reference detail route placeholder using generic item metadata.',
      guard: {
        personas: allPersonas,
        requiredCapabilities: ['extension:inspect'],
        requiredApiScopes: ['extensions.inspect'],
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
      title: 'Open extension reference',
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
