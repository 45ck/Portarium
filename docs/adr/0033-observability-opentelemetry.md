# ADR-0033: OpenTelemetry as Observability Standard

## Status

Accepted

## Context

VAOP orchestrates distributed execution across adapters, machines, and SoR APIs. Debugging failures requires correlated traces across all components. "Bring your own dashboard" requires standardised telemetry.

## Decision

Adopt OpenTelemetry as the observability standard for traces, metrics, and logs. Propagate W3C Trace Context headers across adapter and machine invocations. Every Run carries a trace ID linked to its correlation ID. Adapters and machines must propagate trace context through SoR API calls where possible. Metrics expose run duration, action success/failure rates, approval latency, and quota utilisation. Logs are structured and include trace/span IDs.

## Consequences

- "Defensible execution" includes explainability across distributed components.
- Users can bring their own dashboards (Grafana, Datadog, etc.) via OTLP export.
- Adapters must implement trace context propagation (adds implementation requirement).
- Standardised metrics enable operational alerting out of the box.
