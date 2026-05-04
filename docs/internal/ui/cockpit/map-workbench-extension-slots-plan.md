# Cockpit Map Workbench Extension Slots Plan

> **Date:** 2026-05-04
> **Status:** Proposed
> **Related:** `generic-plugin-host-implementation-plan.md`, `local-extension-readiness-plan.md`, `../../adr/ADR-0147-cockpit-map-workbench-extension-slots.md`

## Purpose

Define how Cockpit should host reusable map-centric operator workflows without
turning one domain route into the generic map contract.

The decision is to introduce a host-owned `CockpitMapWorkbench` surface.
Installed extensions may contribute typed map layers, selectable entities, and
context panels, but Cockpit keeps ownership of activation, routing, layout,
guard checks, selection state, URL state, degraded states, and governed action
handoff.

## Decision

Build a generic map workbench contract and migrate existing map-heavy routes to
adapters over that contract.

Selected option:

| Option | Description                                                            | Outcome                                                                                                                          |
| ------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A      | Expose the existing domain-specific map route as the extension surface | Rejected. It would freeze one domain's terminology and data shape into the platform contract.                                    |
| B      | Add a generic `CockpitMapWorkbench` that domain routes mount and adapt | Selected. It reuses the existing layout patterns while keeping the host boundary generic.                                        |
| C      | Make every layer and panel fully manifest-driven immediately           | Deferred. The current extension runtime hosts routes, but panel/widget projection and map data scopes are not mature enough yet. |

## Design Drivers

- Keep Cockpit and Portarium tenant-neutral.
- Do not allow remote JavaScript or manifest-owned executable imports.
- Preserve fail-closed route activation before importing extension route code.
- Keep direct browser egress constrained to host-approved clients.
- Avoid a map-engine-specific public contract where possible.
- Support desktop split-pane and mobile bottom-sheet workflows.
- Let extensions provide domain-specific panels without owning approval,
  policy, evidence, audit, or execution state.

## Host-Owned Boundary

Cockpit owns:

- route activation, lifecycle, quarantine, emergency disable, and fallback UI,
- extension registry resolution and host-owned import maps,
- desktop/mobile map layout,
- page header integration,
- selected entity state and URL synchronization,
- map viewport shell and base interaction model,
- layer visibility controls, empty/loading/error/degraded states,
- panel containers and tab state,
- host-issued data client and egress policy,
- governed action proposal handoff into Portarium-native review surfaces,
- audit event emission for denied, degraded, and action-proposal flows.

The host must not delegate authority decisions to extension manifests or
extension browser code.

## Extension-Owned Boundary

An installed extension may provide:

- domain layer descriptors,
- domain-specific selectable entity summaries,
- popup or callout renderers,
- list-panel renderers,
- detail-panel renderers,
- secondary context panels,
- route-level commands that submit governed action proposals.

Extension contributions must render data that has already passed the approved
read boundary. They must not directly call external systems, vaults, runtime
daemons, or arbitrary browser origins.

## Proposed Contract Shape

```ts
export interface MapHostWorkbenchProps<TEntity, TLayer, TCommandPayload> {
  title: string;
  subtitle?: string;
  dataState: MapHostDataState;
  map: ReactNode;
  tabs: readonly MapHostPanelTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  panel: ReactNode;
  layers?: readonly MapHostLayerContribution<TLayer>[];
  entities?: readonly MapHostEntity<TEntity>[];
  selection?: MapHostSelectionState;
  panels?: readonly MapHostPanelContribution<TEntity, TCommandPayload>[];
  commands?: readonly MapHostCommandContribution<TCommandPayload>[];
}

export interface MapHostEntity<TEntity> {
  id: string;
  label: string;
  kind: string;
  layerId?: string;
  geometryRef?: string;
  locationRef?: string;
  status?: 'normal' | 'warning' | 'critical' | 'unknown';
  privacyClass: MapHostPrivacyClass;
  freshness: MapHostFreshnessSummary;
  payload: TEntity;
}

export interface MapHostLayerContribution<TLayer> {
  id: string;
  label: string;
  kind: string;
  enabled: boolean;
  defaultEnabled?: boolean;
  privacyClass: MapHostPrivacyClass;
  freshness: MapHostFreshnessSummary;
  payload: TLayer;
}

export interface MapHostPanelContribution<TEntity, TCommandPayload> {
  id: string;
  label: string;
  privacyClass: MapHostPrivacyClass;
  freshness: MapHostFreshnessSummary;
  render: (context: MapHostPanelRenderContext<TEntity, TCommandPayload>) => ReactNode;
}

export interface MapHostCommandContribution<TCommandPayload> {
  id: string;
  label: string;
  scope: 'workbench' | 'selection';
  privacyClass: MapHostPrivacyClass;
  freshness: MapHostFreshnessSummary;
  createProposal: (
    context: MapHostCommandContext,
  ) => MapHostGovernedActionProposal<TCommandPayload>;
}
```

The public implementation currently lives in
`apps/cockpit/src/components/cockpit/map-host/types.ts`. Existing
`MapWorkbenchShell` callers can continue to pass only the shell-oriented props;
layer, entity, panel, and command contribution arrays are additive adapter
metadata for extension-side routes.

## UX Model

Desktop:

- normal Cockpit sidebar remains visible,
- native page header with route status and action slots,
- map canvas on the left,
- persistent context dock on the right,
- layer controls and legend over the map, not in a separate app shell.

Mobile:

- full-screen map region inside the Cockpit shell,
- compact overlay controls,
- snap bottom sheet for list, detail, evidence, and systems context,
- host mobile navigation remains available through the normal shell.

## Security And Privacy Rules

- Extension route code may only use host-issued data clients.
- Direct `fetch`, remote script loading, iframes, raw links to data origins, and
  browser storage of source payloads are outside the allowed model.
- Every layer and panel contribution declares privacy class and freshness.
- Entity and command contributions also declare privacy class and freshness so
  adapter code cannot hide stale or restricted context behind panel rendering.
- Missing privacy or freshness metadata degrades the contribution or fails the
  route closed.
- Action controls create governed proposals only. Approval, execution, audit,
  and evidence lifecycle remain Portarium-owned.
- Local install mode is development-only and must not be treated as a pilot or
  production activation path.

## Implementation Milestones

### M0: Contract And ADR

Exit criteria:

- [ ] `CockpitMapWorkbench` decision is captured in an ADR or accepted plan.
- [ ] Existing domain-specific map route responsibilities are separated into
      host-owned and adapter-owned concerns.
- [ ] Security rules for browser egress and host-issued clients are linked from
      extension docs.

### M1: Generic Workbench Components

Exit criteria:

- [ ] Add `apps/cockpit/src/components/cockpit/map-host/`.
- [ ] Extract desktop split layout and mobile bottom-sheet layout behind a
      generic map-host API.
- [ ] Add selection state and URL codec helpers.
- [ ] Keep the existing domain-specific map route behavior unchanged through an
      adapter.

### M2: Extension Route Integration

Exit criteria:

- [ ] Extension route components can mount `CockpitMapWorkbench`.
- [ ] Extension side panels render inside host-owned panel containers.
- [ ] Denied, inactive, quarantined, missing renderer, and degraded data cases
      continue to use host fallbacks.

### M3: Runtime Enforcement

Exit criteria:

- [ ] Extension loaders and panels receive a constrained host client.
- [ ] Browser egress policy is exercised by production route loading code.
- [ ] Client-side access context includes the server-issued host contract.
- [ ] Map-host tests assert no route imports occur before guard checks pass.

## Test Plan

Unit coverage:

- activation and guard decision table,
- selection state from URL, list click, map click, deselect, and floor/site
  changes,
- layer visibility and status count consistency,
- privacy and freshness metadata validation,
- denied routes never importing route modules.

Component coverage:

- desktop map, panel dock, legend, and layer controls,
- mobile map plus bottom sheet,
- list/detail synchronization,
- degraded data and partial failure states.

End-to-end coverage:

- extension catalog launch,
- direct map deep link,
- selected entity detail panel,
- governed action proposal handoff,
- inactive or unauthorized extension fallback.

## Open Questions

- Should map data queries become a first-class extension data-scope family, or
  remain route-local until more domains use the workbench?
- How much of the map canvas should be engine-agnostic versus explicitly
  optimized for the current renderer?
- Should extension panel slots be declared in the manifest before the first
  generic workbench release, or inferred from route component contributions?
- What is the minimum runtime client enforcement needed before this surface is
  safe outside local development?
