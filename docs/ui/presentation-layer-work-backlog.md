# Presentation Layer Work Backlog (v1)

## Backlog ordering

Priority is sorted by risk and delivery order:

1. Foundation and contract layer
2. Shell and navigation defaults
3. Domain primitives library
4. Approval and run command flow
5. Realtime and fallback
6. Performance hardening
7. Security hardening
8. Test and rollout gates

## Epics and stories

### EPIC-01 — Contract-first data layer (target: 8 PD)

Goal: make all screen work depend on one typed/control-plane boundary.

- STORY-01.1
  - Add typed OpenAPI-oriented control-plane DTOs in `src/presentation/ops-cockpit/types.ts`.
  - AC: DTO names are canonical (`Run`, `Plan`, `Approval`, `Evidence Log`, `Work Item`, `Workspace`).
- STORY-01.2
  - Add Problem Details mapping and typed error class in `src/presentation/ops-cockpit/problem-details.ts`.
  - AC: `instance`, `status`, `title`, `type`, `detail`, and field-level `errors` are preserved for UI actions.
- STORY-01.3
  - Add cursor query builders and page metadata helpers in `src/presentation/ops-cockpit/pagination.ts`.
  - AC: `limit` is capped, `cursor` handling is deterministic.
- STORY-01.4
  - Add command/query client skeleton in `src/presentation/ops-cockpit/http-client.ts` with idempotency key support.
  - AC: start run and approval decision helpers exist with optional `Idempotency-Key`.

### EPIC-02 — Presentation shell and persona-aware defaults (target: 10 PD)

- STORY-02.1
  - Add app shell (workspace selector, system state region, primary navigation).
  - AC: role-specific default views are data-driven, not hardcoded strings.
- STORY-02.2
  - Add persona defaults for route entry points.
  - AC: Operator starts in inbox-first view; Approver starts at pending approval queue; Auditor at evidence-first entry.
- STORY-02.3
  - Add workspace-level system-state banners (empty/misconfigured/policy blocked/RBAC limited/degraded realtime).
  - AC: every state has explicit next action.

### EPIC-03 — Trust UI primitives (target: 12 PD)

- STORY-03.1
  - Implement `EffectsList` with strict Planned / Predicted / Verified ordering.
  - AC: sections render in fixed order and use the same labels everywhere.
- STORY-03.2
  - Implement `EvidenceTimeline` with actor + category filtering.
  - AC: append-only identity and chain verification cues are surfaced.
- STORY-03.3
  - Approval decision form with required rationale.
  - AC: rationale is required for deny/request-changes and displayed in error recovery.

### EPIC-04 — Delivery of critical command flows (target: 16 PD)

- STORY-04.1
  - Implement approval command orchestration.
  - AC: apply, deny, request-changes flows map to API command contracts and surface Problem Details.
- STORY-04.2
  - Implement run cancel command.
  - AC: idempotent command feedback and status revalidation.
- STORY-04.3
  - Implement Work Item to Run detail drill-down with evidence linking.
  - AC: cross-links preserve Workspace and route context.

### EPIC-05 — Realtime + fallback strategy (target: 8 PD)

- STORY-05.1
  - Add event stream client adapter.
  - AC: updates near-realtime when healthy.
- STORY-05.2
  - Add degraded mode fallback polling + staleness indicator.
  - AC: user receives visible warning and explicit "last updated" age.

### EPIC-06 — Performance baseline (target: 6 PD)

- STORY-06.1
  - Implement route-level lazy loading for heavy views.
  - AC: non-critical routes are not eagerly loaded.
- STORY-06.2
  - Introduce pagination-first list rendering and memoized mapping helpers.
  - AC: interaction remains stable on large lists.

### EPIC-07 — Security and hardening (target: 6 PD)

- STORY-07.1
  - Define and publish CSP policy.
  - AC: report-only stage first, then enforce.
- STORY-07.2
  - Validate command payload encoding and forbid dangerous HTML rendering defaults.
- STORY-07.3
  - Document CSRF and token handling assumptions for any cookie-based auth path.

### EPIC-08 — QA and release gates (target: 10 PD)

- STORY-08.1
  - Add unit/component coverage for Problem Details mapping and core primitives.
- STORY-08.2
  - Add E2E smoke for approval + run detail + evidence fallback.
- STORY-08.3
  - Add visual acceptance for trust UI states (effects and evidence).
- STORY-08.4
  - Gate rollout behind feature flags and migrate by domain slice.

## Delivery notes

- Start with a read-only reference cockpit.
- Expand to one command at a time under feature flags.
- Require telemetry thresholds before enabling each stage for all users.
