# Pack Observability Telemetry (v1)

## Goal

Define pack-aware telemetry requirements for workflow and action execution paths.

## Span Attributes

Workflow and action spans must include:

- `pack.id`
- `pack.version`
- `workflow.execution_tier`
- `telemetry.pii_safe: true`

Action spans additionally include:

- `action.id`
- `action.operation`
- `action.port_family`

PII-like runtime identifiers (`tenantId`, `principalId`, `correlationId`, raw auth data) must not
appear in span attributes.

## Metric Requirements

The runtime must emit per-pack counters/histograms:

- Run counters:
  - `portarium.run.started`
  - `portarium.run.succeeded`
  - `portarium.run.failed`
- Run latency histogram:
  - `portarium.run.duration.ms`
- Action counters:
  - `portarium.action.succeeded`
  - `portarium.action.failed`
- Action latency histogram:
  - `portarium.action.duration.ms`

All metrics include pack labels and `telemetry.pii_safe: true`.

## Dashboard and Regression Detectors

Ship and maintain:

- pack observability dashboard artifact for success/failure/latency views,
- regression detector alerts for:
  - run failure-rate regression,
  - run latency regression,
  - action latency regression,
  - missing pack label coverage regression.
