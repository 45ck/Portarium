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
