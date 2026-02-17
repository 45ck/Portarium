# Portarium Presentation Layer Plan (v1)

## Purpose

This plan defines the reference implementation shape for the Portarium presentation layer as a **web reference cockpit**. It is API-first, multi-tenant, and audit-centered.

The dashboard is treated as a client view of the Control Plane, not the control-plane runtime itself.  
Primary non-goals are business policy evaluation and source-of-truth state transitions.

## Core constraints from Portarium

- UI is a **reference client** for `v1` Control Plane contracts under `/v1/workspaces/{workspaceId}/...`.
- Vocabulary must match `docs/glossary.md` (`Workspace`, `Work Item`, `Plan`, `Approval Gate`, `Run`, `Evidence Log`, etc.).
- Control-plane objects drive UI semantics: `Workspaces`, `Work Items`, `Plans`, `Runs`, `Approvals`, `Evidence`.
- Primary personas: `Operator`, `Approver`, `Auditor`, `Admin`.
- Explicit system states are first-class UX affordances:
  - Empty
  - Misconfigured
  - Policy blocked
  - RBAC-limited
  - Degraded realtime
- Trust UI rule: consistently render Planned / Predicted / Verified effects.

## Presentation responsibilities

- Render domain state with predictable visual language.
- Orchestrate user intent into Control Plane commands (start run, submit approval decisions).
- Keep interaction state small and explicit (selection, filters, drawer state, pagination cursors).
- Enforce accessibility, security posture, and error ergonomics.
- Keep source-of-truth in the server; UI owns cache, staleness, and optimistic UX only.

## What the presentation layer must *not* do

- Decide policy outcomes (SoD, tiering, constraints).
- Perform authoritative workflow orchestration.
- Ignore contract errors or render free-form unknown error text.

## Recommended architecture

### Structural pattern

- Use a **component-based** structure.
- Apply **unidirectional flow** for shared state updates (Flux/Redux principles) while keeping local state local.
- Keep container-orchestration separate from presentational primitives:
  - **Primitives**: `EffectsList`, `EvidenceTimeline`, `ApprovalDecisionForm`, `RunStatusChip`
  - **Containers/pages**: route boundaries + data orchestration + commands
  - **Data adapters**: HTTP client, cursor pagination, event stream, telemetry

### Data-state split

- **Server state**: runs, plans, evidence, approvals, work items, status.  
  - Use a server-state cache abstraction in the first package.
- **UI state**: local selections, filters, pagination cursors, modal visibility, nav context.
  - Keep this in a small explicit store, not spread globally.

### Error contract

- All API failures in JSON should be mapped from Problem Details to typed UI errors:
  - `type`, `title`, `status`, `detail`, `instance`, optional field-level `errors`.
- Preserve `instance` for support handoff and trace correlation.

## Layer boundaries

- `src/presentation` hosts the reference UI surfaces and client adapters.
- Domain and application layers stay unchanged in authority and logic ownership.
- Keep response shaping at the data boundary before components consume DTOs.

## Canonical folder model

Recommended:

```text
src/
  presentation/
    ops-cockpit/
      client/
      errors/
      pagination/
      ui/
```

- `client/`: typed API and mutation wrappers.
- `errors/`: Problem Details mapping + classification.
- `pagination/`: cursor helpers and page metadata.
- `ui/`: domain primitives first, then pages and containers.

## Component rules

1. Primitives should be pure: props in, events out.
2. Containers are authoritative for fetching, retries, idempotency keys, and optimistic state.
3. All trust UI screens use the same effect language and rendering order.
4. Keyboard and focus behavior are mandatory for core flows.
5. Deep links and evidence links are stable and visible.

## Interaction states and surfaces

- Default screen by persona:
  - Operator: attention queue and actionable work.
  - Approver: pending approval queue first.
  - Auditor: Evidence Log first.
  - Admin: workspace controls and policy impact state.
- Always render a staleness/status region:
  - data freshness
  - command success/failure
  - degraded realtime notice with explicit fallback explanation.

## Accessibility baseline

- Baseline: **WCAG 2.2 AA**.
- Keyboard-only command flows must include:
  - table and list navigation
  - approval actions
  - modal/drawer focus traps and clear focus visibility
- Status and policy text must not depend on color alone.
- Approval rationale and errors should be announced with proper roles/labels.

## Security and integrity baseline

- Strict output handling for untrusted server labels/strings.
- CSP hardening and CSP report-only rollout plan in phase 2.
- Idempotent command execution using idempotency keys on mutating operations.
- Token handling in API client only; no token leakage in URL/query strings.

## Performance baseline

- Route-level lazy loading for heavy screens.
- API list endpoints use cursor pagination by default.
- Stale-while-revalidate strategy via server-state cache in the first package.
- Realtime stream with polling fallback and explicit staleness indicators.

## Testing targets for v1

- Contract layer: typed response checks and focused unit tests around parsing/error mapping.
- Component tests for core primitives and empty/error states.
- E2E smoke:
  - open run + approval detail
  - submit rationale for approval decision
  - fallback view when stream is unavailable
- Accessibility baseline checks in Storybook or equivalent workflow for primitives.

## Rollout and migration

- Stage 1: read-only cockpit surfaces (Work Items, Runs, Evidence views).
- Stage 2: one command surface (approval decision) with rationale capture and Problem Details mapping.
- Stage 3: remaining command surfaces and richer filters.
- Stage 4: event stream and degraded fallback behavior.
- Stage 5: visual/behavioral gates as merge requirements.

## First package implementation goal

The first package focuses on `Contract-first data layer`:

- OpenAPI-aware typed client skeleton
- Problem Details mapping
- Cursor pagination helpers
- Mutation helpers with optional idempotency key propagation
- Minimal query cancellation and response parsing utility

The repository now contains a working skeleton at:

- `src/presentation/ops-cockpit/types.ts`
- `src/presentation/ops-cockpit/problem-details.ts`
- `src/presentation/ops-cockpit/pagination.ts`
- `src/presentation/ops-cockpit/http-client.ts`

with an index export in `src/presentation/index.ts`.

## Risks and mitigations

- Contract drift: lock schema names with API fixtures and review PR gates.
- Over-abstracted front-end state: keep stores small and domain-focused.
- Misleading realtime: show explicit data age and fallback path when stream degrades.
- Security regressions in templated rendering: enforce safe rendering defaults and review any raw HTML escapes.
