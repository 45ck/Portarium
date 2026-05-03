# Cockpit Extension SDK

`@portarium/cockpit-extension-sdk` is the public TypeScript package for build-time installed Cockpit Extensions. It exposes the versioned manifest v1 types and conformance helpers used before a package is eligible for host review.

## Contract

The manifest is data only. Extension authors can declare:

- identity, version, and pack activation keys
- route references under `/external/`
- navigation items, command palette entries, and shortcuts
- host-owned guards for personas, capabilities, API scopes, and privacy classes
- governance metadata for permission grants, audit events, emergency disable, and rollback

The manifest cannot declare remote executable code, browser egress origins, credentials, provider endpoints, webhooks, or direct side-effect authority. Extension UI must use Portarium Control Plane APIs through the Cockpit Extension Host.

## Conformance

External packages can run the conformance helper in their own test suite:

```ts
import {
  assertCockpitExtensionManifestV1Conforms,
  type CockpitExtensionManifestV1,
} from '@portarium/cockpit-extension-sdk';

import { manifest } from './manifest';

manifest satisfies CockpitExtensionManifestV1;

assertCockpitExtensionManifestV1Conforms({
  manifest,
  packageRef: {
    packageName: '@example/cockpit-extension',
    version: '0.1.0',
  },
  workspacePackRefs: [{ packId: 'example.extension' }],
  routeModuleIds: ['example-overview'],
});
```

The helper returns a report with deterministic route projection data. It fails when manifest shape, registry activation, guard coverage, install-boundary metadata, route module IDs, or projected routes drift from the host contract.

Keep examples generic. Do not publish tenant-specific routes, schemas, names, object samples, workspace IDs, or provider endpoints in extension SDK docs or manifests.
