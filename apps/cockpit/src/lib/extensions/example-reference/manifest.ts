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
      permissionGrantIds: ['reference.extensionContext.read'],
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
      permissionGrantIds: ['reference.extensionContext.inspect'],
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
      permissionGrantIds: ['reference.extensionContext.read'],
      shortcut: 'G X',
    },
  ],
  governance: {
    identity: {
      publisher: 'portarium',
      attestation: {
        kind: 'source-review',
        subject: 'apps/cockpit/src/lib/extensions/example-reference',
        digestSha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        issuedAtIso: '2026-04-30T00:00:00.000Z',
      },
    },
    versionPin: {
      packageName: '@portarium/cockpit-example-reference-extension',
      version: '0.1.0',
      sourceRef: 'apps/cockpit/src/lib/extensions/example-reference',
    },
    permissions: [
      {
        id: 'reference.extensionContext.read',
        kind: 'data-query',
        title: 'Read reference extension overview data',
        requiredCapabilities: ['extension:read'],
        requiredApiScopes: ['extensions.read'],
        policySemantics: 'authorization-required',
        evidenceSemantics: 'read-audited-by-control-plane',
        auditEventTypes: ['enable', 'disable', 'upgrade'],
      },
      {
        id: 'reference.extensionContext.inspect',
        kind: 'data-query',
        title: 'Inspect reference extension details',
        requiredCapabilities: ['extension:inspect'],
        requiredApiScopes: ['extensions.inspect'],
        policySemantics: 'authorization-required',
        evidenceSemantics: 'read-audited-by-control-plane',
        auditEventTypes: ['enable', 'disable', 'upgrade'],
      },
    ],
    lifecycle: {
      emergencyDisable: {
        mode: 'activation-source',
        suppresses: ['routes', 'navigation', 'commands', 'shortcuts', 'data-loading'],
      },
      rollback: {
        mode: 'disable-only',
      },
      auditEvents: ['install', 'enable', 'disable', 'emergency-disable', 'upgrade', 'rollback'],
    },
  },
} as const satisfies CockpitExtensionManifest;
