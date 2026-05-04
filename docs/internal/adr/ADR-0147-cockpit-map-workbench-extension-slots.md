# ADR-0147: Cockpit Map Workbench Extension Slots

**Beads:** bead-1162, bead-1163, bead-1164, bead-1165, bead-1166, bead-1167
**Status:** Proposed
**Date:** 2026-05-04

## Context

ADR-0126 defines the compile-time Cockpit extension host. ADR-0145 defines the
generic plugin host and control-plane contract. Cockpit now needs a reusable
map-centric operator surface that can host domain-specific map workflows without
turning one existing route into the platform contract.

The existing Cockpit map route already proves several useful UI patterns:
desktop map/list/detail composition, mobile bottom-sheet behavior, layer
toggles, alert/detail context, and query-linked selection. However, the current
route is composed around one domain's entity model. Reusing it directly as the
extension contract would couple the generic host to the wrong vocabulary.

## Drivers

- Keep Cockpit and Portarium tenant-neutral.
- Preserve host-owned route activation, guard checks, lifecycle state, and
  fail-closed imports.
- Let extensions contribute domain-specific layers and context panels.
- Keep approval, execution, evidence, audit, and policy state Portarium-owned.
- Keep browser code away from unmanaged egress, source payloads, secrets, and
  direct side effects.
- Support desktop split-pane and mobile bottom-sheet workflows from one host
  contract.
- Avoid freezing the public contract to a specific map renderer if practical.

## Decision Problem

How should Cockpit support extension-provided map layers and custom side panels
while keeping layout, activation, privacy, egress, and governed-action authority
in the host?

## Options Considered

| Option | Summary | Generic fit | Security fit | Delivery cost | Decision |
| --- | --- | --- | --- | --- | --- |
| A | Expose the existing map route as the extension surface | Low | Medium | Low | Rejected |
| B | Add a generic `CockpitMapWorkbench` mounted by route components | High | High | Medium | Selected |
| C | Make all map layers and panels manifest-driven now | Medium | Medium | High | Deferred |

### Option A: Expose Existing Route

This is the fastest path, but it turns current route-specific concepts into
platform vocabulary. It also makes future domains inherit behavior they may not
need and makes testing harder because selection, layout, and detail panels stay
coupled to one entity model.

### Option B: Generic Workbench Mounted By Routes

The host provides a reusable workbench shell with typed contributions for map
layers, selectable entities, selection encoding, commands, and panels. Extension
route components mount the workbench and provide domain adapters. Cockpit keeps
ownership of activation, route import, layout, selection state, URL sync,
fallbacks, runtime clients, and governed action handoff.

Selected because it preserves reuse without moving authority into extensions.

### Option C: Manifest-Driven Map Surface

A fully declarative map/panel surface may become useful later, but the current
extension runtime does not yet project widget/panel slots or map/location data
scopes broadly enough. Doing this now would force premature schema decisions.

## Decision

Introduce a generic Cockpit map workbench surface. Extension route components
may mount the workbench and provide typed contributions, but Cockpit remains the
owner of:

- extension activation and lifecycle checks,
- fail-closed route resolution before import,
- desktop and mobile workbench layout,
- selected entity state and URL synchronization,
- host-issued runtime clients,
- privacy and freshness metadata validation,
- loading, empty, error, denied, and degraded states,
- governed action proposal handoff,
- audit events for denied, degraded, and proposal flows.

The initial implementation should be component-level. It should not require a
fully manifest-driven map slot system before proving the API.

## Workbench Contract

The first host contract should include:

- layer contributions with stable IDs, labels, kinds, visibility defaults,
  freshness, and privacy class,
- selectable entities with stable IDs, labels, kinds, geometry refs, optional
  floor/site IDs, status, privacy class, and typed payload,
- a selection codec for URL serialization and parsing,
- data state for loading, empty, ready, stale, degraded, denied, and error
  modes,
- panel contributions for list, detail, evidence, systems, and secondary
  context,
- command contributions that create governed proposals rather than direct
  mutations.

Names can evolve, but the boundary must remain: host owns the shell and
authority; adapters own domain presentation.

## Security And Privacy Rules

- Extension code must not call arbitrary external origins.
- Extension code must not load remote JavaScript or iframe provider surfaces.
- Workbench data must not include source secrets, browser storage, raw blobs,
  raw source snapshots, or unredacted sensitive payloads.
- Every layer and panel contribution must declare privacy and freshness
  metadata or fail closed/degrade.
- Local install authority expansion is development-only and cannot be treated
  as production activation.
- Approval, denial, execution, and audit remain Portarium-native.

## Consequences

Positive:

- Cockpit gets one reusable map workflow surface instead of domain-specific
  copies.
- Existing map routes can migrate gradually through adapters.
- Future extensions can provide custom side panels without owning the shell or
  policy state.
- The workbench can share guard, fallback, privacy, and selection tests.

Negative:

- The first implementation is more work than directly exposing the current map
  route.
- Extension panel slots will exist before the broader widget projection model
  is fully mature.
- Renderer-agnostic design requires discipline to avoid leaking current
  renderer concepts into public types.

## Implementation Plan

1. Add map-host types, shell, desktop layout, mobile layout, and selection
   helpers under Cockpit components.
2. Add panel contribution types and degraded-state behavior.
3. Bind workbench routes to host-issued runtime clients and browser-egress
   policy.
4. Add guard, selection, panel, degraded, and no-raw-payload tests.
5. Migrate the existing map route through an adapter after the generic host is
   stable.

## Open Questions

- Should map data scopes become first-class extension data scopes immediately,
  or stay route-local until multiple domains use the workbench?
- Should the first public component contract be renderer-agnostic, or should it
  intentionally expose current renderer semantics for delivery speed?
- Should panel slots be declared in manifests before v1, or remain route-module
  contributions until the extension widget model stabilizes?
