# Cockpit Extension SDK

`@portarium/cockpit-extension-sdk` exposes the versioned Cockpit extension manifest contract and conformance helpers for build-time installed Cockpit Extensions.

The SDK is intentionally data-only. A manifest can declare routes, navigation, commands, guards, permission grants, governance metadata, and lifecycle controls. It cannot grant permissions, declare browser egress origins, or point Cockpit at remote executable code.

```ts
import {
  assertCockpitExtensionManifestV1Conforms,
  type CockpitExtensionManifestV1,
} from '@portarium/cockpit-extension-sdk';

const manifest = {
  manifestVersion: 1,
  id: 'example.extension',
  owner: 'example-publisher',
  version: '0.1.0',
  displayName: 'Example Extension',
  description: 'Adds a reviewed external route to Cockpit.',
  packIds: ['example.extension'],
  personas: ['Operator'],
  requiredCapabilities: ['extension:read'],
  requiredApiScopes: ['extensions.read'],
  routes: [],
  navItems: [],
  commands: [],
  governance: {
    identity: {
      publisher: 'example-publisher',
      attestation: {
        kind: 'source-review',
        subject: 'reviewed-source',
        digestSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    },
    versionPin: {
      packageName: '@example/cockpit-extension',
      version: '0.1.0',
    },
    permissions: [
      {
        id: 'example.read',
        kind: 'data-query',
        title: 'Read extension data',
        requiredCapabilities: ['extension:read'],
        requiredApiScopes: ['extensions.read'],
        policySemantics: 'authorization-required',
        evidenceSemantics: 'read-audited-by-control-plane',
        auditEventTypes: ['cockpit.extension.data.read'],
      },
    ],
    lifecycle: {
      emergencyDisable: {
        mode: 'activation-source',
        suppresses: ['routes', 'navigation', 'commands', 'shortcuts', 'data-loading'],
      },
      rollback: { mode: 'disable-only' },
      auditEvents: ['install', 'enable', 'disable', 'emergency-disable'],
    },
  },
} satisfies CockpitExtensionManifestV1;

assertCockpitExtensionManifestV1Conforms({
  manifest,
  packageRef: {
    packageName: '@example/cockpit-extension',
    version: '0.1.0',
  },
  workspacePackRefs: [{ packId: 'example.extension' }],
});
```

For route-bearing packages, pass `routeModuleIds` with the host-reviewed route module IDs that will be installed by Cockpit. The conformance helper checks the manifest, registry activation, guards, install boundary, and deterministic route projection before the package is eligible for host review.
