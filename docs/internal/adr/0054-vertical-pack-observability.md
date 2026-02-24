# ADR-0054: Vertical Pack Observability and Telemetry

## Status

Accepted

## Context

Composed workflows spanning core steps, pack steps, and connector invocations are difficult to debug without correlated telemetry. Pack-aware observability is essential for operational support and SLO enforcement.

## Decision

Implement pack-aware telemetry extending the OpenTelemetry foundation from ADR-033.

- Traces for workflow execution include pack ID and pack version as resource attributes on every span.
- Metrics expose success/failure rates, latency, and queue depth per pack, per connector, and per tenant.
- Logs are structured with trace/span IDs, pack context, and tenant context.
- Per-pack dashboards and "regression detectors" are required before scaling beyond two verticals.
- PII scrubbing rules from ADR-028 apply to all telemetry data.

## Consequences

- Supports debugging multi-pack workflow composition; enables SLOs per tenant/vertical
- Cost of instrumentation and data volume increases with pack count
- PII scrubbing adds processing overhead
- Pack-aware dashboards provide operational visibility per vertical

## Alternatives Considered

- **Vendor-specific monitoring only** -- poor portability and hard correlation
- **No pack-level telemetry** -- makes debugging composed workflows extremely difficult

## Implementation Mapping

ADR-0054 implementation now spans baseline observability plus pack-aware telemetry coverage:

- `bead-0043` (closed): OTel context propagation across request/workflow/adapter/machine paths.
- `bead-0313` (closed): command-level observability hooks and security-safe attributes.
- `bead-0385` (closed): local OTel collector stack wiring for development observability.
- `bead-0687` (open): tenant/pack-aware observability hardening and telemetry traceability
  completion.

## Acceptance Evidence

- Workflow/action pack-aware spans and metrics:
  - `src/infrastructure/temporal/activities.ts`
  - `src/infrastructure/temporal/activities.test.ts`
  - `src/infrastructure/observability/metrics-hooks.ts`
- Pack-context propagation through workflow orchestration:
  - `src/domain/workflows/workflow-v1.ts`
  - `src/domain/workflows/workflow-v1.test.ts`
  - `src/application/commands/start-workflow.ts`
  - `src/application/ports/workflow-orchestrator.ts`
  - `src/infrastructure/temporal/temporal-workflow-orchestrator.ts`
  - `src/infrastructure/temporal/temporal-workflow-orchestrator.test.ts`
  - `src/infrastructure/temporal/workflows.ts`
  - `src/infrastructure/temporal/workflows.test.ts`
- Per-pack dashboard and regression detector assets:
  - `infra/otel/dashboards/pack-observability.dashboard.json`
  - `infra/otel/alerts/pack-regression-detectors.yaml`
  - `infra/otel/README.md`
- Specification and review linkage:
  - `.specify/specs/pack-observability-telemetry-v1.md`
  - `docs/internal/review/bead-0607-adr-0054-implementation-mapping-review.md`

## Remaining Gap Tracking

- `bead-0687` (open): finalize tenant-aware telemetry linkage and close remaining ADR-0054
  observability traceability drift.
