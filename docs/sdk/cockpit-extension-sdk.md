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

## Host-Native Surfaces

Extensions should prefer host-native surfaces over custom route components.
When a route module exports:

```ts
export const hostRendering = { mode: 'host-native' } as const;
```

Cockpit ignores the module's custom `default` component, calls the route loader,
and renders the returned `nativeSurface` with Portarium/Cockpit design-system
components.

The first supported surface kinds are:

- `portarium.native.dataExplorer.v1` for read-only source catalogues,
  metrics, insight cards, and integration-boundary summaries.
- `portarium.native.ticketInbox.v1` for inbox/list/detail workflows.
- `portarium.native.mapWorkbench.v1` for provider-backed and custom map
  workbenches.

For `portarium.native.dataExplorer.v1`, each source descriptor should include
counts, freshness/privacy labels, source refs, useful questions, visualisation
targets, connector IDs, and capability IDs where available. Cockpit renders
those as evidence metadata only; extensions should not include raw records,
credentials, tokens, or provider payloads in the descriptor.

Use provider-backed map options for Earth, Google Maps, Leaflet, or compatible
geospatial context. Use custom map options for indoor/vector maps, floor plans,
room geometry, and domain overlays. Both modes run inside the same Cockpit map
workbench shell; extensions contribute data, layers, refs, and read-only
context, not map chrome or write authority.

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
