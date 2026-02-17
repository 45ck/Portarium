# Presentation Layer Work Backlog (v2)

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
9. Cross-cutting (state mgmt, a11y, observability, deployment)

## Epics and stories

### EPIC-00 — Cockpit MVP milestone

Goal: deliver the minimum cockpit that makes Portarium operable by real approver, operator, and admin roles.

- STORY-00.1 — bead-0427
  - Cockpit UI MVP — approver queue (approve/deny with rationale and RequestChanges once bead-0419 is done), run list with planned-vs-verified diff, work item creation, adapter registration overview.
  - AC: approver can process an approval end-to-end; operator can start and monitor a run with evidence; admin can register an adapter; all screens connect to the live OpenAPI v1 backend (not mocks); WCAG 2.2 AA baseline met.

### EPIC-P10 — Machine runtime registry API and cockpit Agents screen

Goal: expose machine/agent lifecycle management through the control-plane contract and the cockpit.

- STORY-P10.1 — bead-0438
  - OpenAPI v1 machine runtime endpoints — `GET/POST /v1/workspaces/{ws}/machines` (list/register) and `POST /v1/workspaces/{ws}/machines/{id}/test` (connection smoke-test to Gateway). RBAC: admin-only for write; operator/auditor for read. Problem Details on all error paths.
  - AC: routes added to `portarium-control-plane.v1.yaml`; handlers implement OpenAPI contract; smoke-test issues a safe `/tools/invoke` probe and records evidence entry.
- STORY-P10.2 — bead-0439
  - OpenAPI v1 agent configuration endpoints — `GET/POST /v1/workspaces/{ws}/agents` and `PATCH /v1/workspaces/{ws}/agents/{id}` (update capability allowlist, policy tier). RBAC enforced per IAM MVP.
  - AC: routes added to OpenAPI spec; handlers enforce tenant scoping and RBAC; agent capability updates emit evidence entries; problem+json on errors.
- STORY-P10.3 — bead-0440
  - Cockpit "Agents" screen — machine connection test, capability allowlist editing, "used by workflows" query; depends on bead-0427 (cockpit MVP) and bead-0438/0439 (API endpoints).
  - AC: operator can register a machine and run a connection test; admin can edit capability allowlist; screen shows which workflows reference each agent; WCAG 2.2 AA baseline met.

### EPIC-01 — Contract-first data layer (target: 8 PD)

Goal: make all screen work depend on one typed/control-plane boundary.

- STORY-01.1 — **DONE** (bead-0295, closed)
  - Add typed OpenAPI-oriented control-plane DTOs in `src/presentation/ops-cockpit/types.ts`.
  - AC: DTO names are canonical (`Run`, `Plan`, `Approval`, `Evidence Log`, `Work Item`, `Workspace`).
- STORY-01.2 — **DONE** (bead-0295, closed)
  - Add Problem Details mapping and typed error class in `src/presentation/ops-cockpit/problem-details.ts`.
  - AC: `instance`, `status`, `title`, `type`, `detail`, and field-level `errors` are preserved for UI actions.
- STORY-01.3 — **DONE** (bead-0295, closed)
  - Add cursor query builders and page metadata helpers in `src/presentation/ops-cockpit/pagination.ts`.
  - AC: `limit` is capped, `cursor` handling is deterministic.
- STORY-01.4 — **DONE** (bead-0295, closed; test gap: bead-0333, open)
  - Add command/query client skeleton in `src/presentation/ops-cockpit/http-client.ts` with idempotency key support.
  - AC: start run and approval decision helpers exist with optional `Idempotency-Key`.
- STORY-01.5 — bead-0342
  - Generate typed API client from OpenAPI + runtime response validation at boundary.
  - AC: compile-time types from OpenAPI spec; responses decoded/validated once at boundary.
- STORY-01.6 — bead-0373
  - Error UX mapping: Problem Details (RFC 9457) to actionable banners with `instance` IDs for support.
  - AC: every Problem Details response maps to user-visible callout; `instance` preserved for support.

### EPIC-02 — Presentation shell and persona-aware defaults (target: 10 PD)

- STORY-02.1 — bead-0343
  - Add app shell (workspace selector, system state region, primary navigation).
  - AC: role-specific default views are data-driven, not hardcoded strings.
- STORY-02.2 — bead-0344
  - Add persona defaults for route entry points.
  - AC: Operator starts in inbox-first view; Approver starts at pending approval queue; Auditor at evidence-first entry.
- STORY-02.3 — bead-0345
  - Add workspace-level system-state banners (empty/misconfigured/policy blocked/RBAC limited/degraded realtime).
  - AC: every state has explicit next action.

### EPIC-03 — Trust UI primitives (target: 12 PD)

- STORY-03.1 — bead-0346
  - Implement `EffectsList` with strict Planned / Predicted / Verified ordering.
  - AC: sections render in fixed order and use the same labels everywhere.
- STORY-03.2 — bead-0347
  - Implement `EvidenceTimeline` with actor + category filtering.
  - AC: append-only identity and chain verification cues are surfaced.
- STORY-03.3 — bead-0348
  - Approval decision form with required rationale.
  - AC: rationale is required for deny/request-changes and displayed in error recovery.
- STORY-03.4 — bead-0372
  - RunStatusChip + WorkspaceSwitcher shared domain primitives.
  - AC: consistent status rendering across all views; workspace context preserved.

### EPIC-04 — Delivery of critical command flows (target: 16 PD)

- STORY-04.1 — bead-0349
  - Implement approval command orchestration.
  - AC: apply, deny, request-changes flows map to API command contracts and surface Problem Details.
- STORY-04.2 — bead-0350
  - Implement run cancel command.
  - AC: idempotent command feedback and status revalidation.
- STORY-04.3 — bead-0351
  - Implement Work Item to Run detail drill-down with evidence linking.
  - AC: cross-links preserve Workspace and route context.

### EPIC-05 — Realtime + fallback strategy (target: 8 PD)

Related: bead-0326 (API transport strategy, open)

- STORY-05.1 — bead-0352
  - Add event stream client adapter.
  - AC: updates near-realtime when healthy.
- STORY-05.2 — bead-0353
  - Add degraded mode fallback polling + staleness indicator.
  - AC: user receives visible warning and explicit "last updated" age.

### EPIC-06 — Performance baseline (target: 6 PD)

- STORY-06.1 — bead-0354
  - Implement route-level lazy loading for heavy views.
  - AC: non-critical routes are not eagerly loaded.
- STORY-06.2 — bead-0355
  - Introduce pagination-first list rendering and memoized mapping helpers.
  - AC: interaction remains stable on large lists.
- STORY-06.3 — bead-0371
  - Static asset caching strategy (immutable hashed assets, short-lived HTML) per RFC 9111.
  - AC: caching headers validated in deployment smoke test.

### EPIC-07 — Security and hardening (target: 6 PD)

- STORY-07.1 — bead-0356
  - Define and publish CSP policy.
  - AC: report-only stage first, then enforce.
- STORY-07.2 — bead-0357
  - Validate command payload encoding and forbid dangerous HTML rendering defaults.
- STORY-07.3 — bead-0358
  - Document CSRF and token handling assumptions for any cookie-based auth path.
- STORY-07.4 — bead-0367
  - Trusted Types pilot for DOM XSS prevention.
  - AC: report-only rollout; document breakage and remediation.
- STORY-07.5 — bead-0368
  - HSTS enforcement for production domains.
  - AC: Strict-Transport-Security header present on all responses.

### EPIC-08 — QA and release gates (target: 10 PD)

- STORY-08.1 — bead-0359 (also bead-0333 for http-client specifically)
  - Add unit/component coverage for Problem Details mapping and core primitives.
- STORY-08.2 — bead-0360
  - Add E2E smoke for approval + run detail + evidence fallback.
- STORY-08.3 — bead-0361
  - Add visual acceptance for trust UI states (effects and evidence).
- STORY-08.4 — bead-0362
  - Gate rollout behind feature flags and migrate by domain slice.
- STORY-08.5 — bead-0374
  - CI gate: lint, typecheck, unit, component, build artefact, E2E smoke, visual regression.

### EPIC-09 — Cross-cutting concerns

- STORY-09.1 — bead-0370
  - Rendering strategy decision: CSR default with static asset deployment; SSR hybrid only if required.
- STORY-09.2 — bead-0363
  - State management architecture: TanStack Query (server state) + Zustand (UI state).
- STORY-09.3 — bead-0364
  - Storybook + a11y addon setup for domain primitives development.
- STORY-09.4 — bead-0366
  - WCAG 2.2 AA accessibility baseline + keyboard-first interaction for all critical workflows.
- STORY-09.5 — bead-0369
  - Chromatic visual regression for trust UI components (effects, evidence, approval).
- STORY-09.6 — bead-0365
  - OpenTelemetry browser instrumentation (RUM navigation traces, API latency, error rates).
- STORY-09.7 — bead-0376
  - Alerting SLOs: page load, approval interaction latency, API error rate, stale-data duration.
- STORY-09.8 — bead-0375
  - Immutable versioned artefact deployment with CDN caching + fast rollback.
- STORY-09.9 — bead-0377
  - Dual-run migration mode (old UI + new UI in parallel with audit parity verification).

## New beads created for this backlog

| Bead | Title |
|---|---|
| bead-0427 | Presentation: cockpit UI MVP - approver queue (approve/deny with rationale), run list with planned-vs-verified diff, work item creation, adapter registration overview |
| bead-0438 | Presentation: OpenAPI v1 machine runtime registry endpoints (GET/POST /machines, POST /machines/{id}/test) |
| bead-0439 | Presentation: OpenAPI v1 agent configuration endpoints (GET/POST /agents, PATCH /agents/{id}) |
| bead-0440 | Presentation: cockpit Agents screen (machine connection test, capability allowlist, used-by-workflows query) |

## Pre-existing beads (cross-reference)

| Bead | Status | Relevance |
|---|---|---|
| bead-0165 | open | Phase transition gate: Presentation complete |
| bead-0264 | open | Closeout review for bead-0165 |
| bead-0293 | closed | Cockpit prototype UX fixes |
| bead-0295 | closed | First-pass presentation layer reference package |
| bead-0326 | open | API transport strategy (HTTP/WS) |
| bead-0333 | open | ops-cockpit http-client test coverage |
| bead-0336 | open | ops-cockpit route handlers, middleware, OpenAPI spec |

## Delivery notes

- Start with a read-only reference cockpit (Stage 1).
- Expand to one command at a time under feature flags (Stage 2-3).
- Add realtime with degraded mode semantics (Stage 4).
- Require telemetry thresholds before enabling each stage for all users.
- Visual regression + accessibility gates become merge requirements (Stage 5).
