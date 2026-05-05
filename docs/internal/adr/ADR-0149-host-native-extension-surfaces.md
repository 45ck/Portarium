# ADR-0149: Host-Native Cockpit Extension Surfaces

**Status:** Proposed
**Date:** 2026-05-06

## Context

Cockpit extensions can currently export route components. That is useful for
early proofs, but it lets each extension invent layout, buttons, badges,
forms, tables, map shells, and side panels. The result is inconsistent UX and a
weaker governance boundary: tenant packages start owning presentation concerns
that should be Portarium-native.

The extension host already supports data-only route loaders. Cockpit also has
reusable primitives for page headers, badges, cards, buttons, filters, list
shells, and map workbenches. The missing contract is a way for an extension to
opt into host-rendered surfaces while keeping its data and route intent outside
Portarium.

## Decision

Add a host-native rendering path for route modules:

- route modules may export `hostRendering = { mode: "host-native" }`,
- Cockpit then ignores a custom `default` route component and uses the route
  loader instead,
- the loader returns a `nativeSurface` descriptor,
- Cockpit renders that descriptor using Portarium/Cockpit components and map
  workbench primitives.

The first native surface kinds are:

- `portarium.native.dataExplorer.v1`
- `portarium.native.ticketInbox.v1`
- `portarium.native.mapWorkbench.v1`

Use the data explorer surface for read-only source landscapes where an
extension contributes source descriptors, counts, freshness/privacy labels,
useful questions, and integration notes. This keeps tenant-specific data
discovery inside the extension while Cockpit owns the reusable source-catalogue
UI.

Extension packages may still keep fallback route components for local contract
tests or older hosts, but the Cockpit runtime should prefer host-native
surfaces whenever the module opts in.

## Map Rule

Map extensions should not choose between a provider map and a custom map at the
platform level. The host map workbench supports both:

- provider-backed base maps for geospatial, outdoor, Earth, Google Maps,
  Leaflet, or compatible adapters,
- custom indoor/vector maps for floor plans, rooms, campus-specific geometry,
  and operational overlays.

Extensions contribute base-map options, layers, entities, selection refs,
read-only context, and governed commands. Cockpit owns the map shell, desktop
and mobile layout, tab/side-panel frame, status, privacy affordances, and
eventual provider adapters.

## Consequences

Positive:

- Extension UX remains visually consistent with Cockpit.
- Design-system changes apply to extensions without tenant rewrites.
- Tenant packages avoid importing Cockpit UI internals directly.
- Map workflows can mix Earth/provider context and custom indoor maps through
  one host shell.
- Source-system access, egress, writeback, and governed proposals stay
  Portarium-owned.

Negative:

- Native surface schemas need versioning and compatibility discipline.
- Highly specialized extension UI must wait for a host primitive or surface
  schema instead of shipping arbitrary route components.
- Existing component-based proofs need migration to host-native descriptors.

## Implementation Notes

The initial implementation is intentionally route-loader based. It does not
make native surfaces a manifest field yet, because route data can evolve faster
while the contract is still being proven.

Later work should move stable surface schemas into the public SDK, add
conformance checks for native surface descriptors, and document which Cockpit
components each surface kind maps to.
