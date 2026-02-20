# OTel Pack Observability Assets

This folder contains local collector config plus pack-aware observability assets for ADR-0054.

## Collector config

- `collector-config.yaml`: baseline local OTLP collector pipeline.

## Pack dashboards

- `dashboards/pack-observability.dashboard.json`
  - Run success/failure rates by `pack_id`.
  - Run latency p95 by `pack_id`.
  - Action latency and failure rates by `pack_id` and `action_operation`.

## Regression detectors

- `alerts/pack-regression-detectors.yaml`
  - Failure-rate regression detector.
  - Run/action latency regression detectors.
  - Telemetry-label coverage detector (`pack_id` missing).

## Telemetry attribute mapping

Runtime emits pack-aware attributes using dotted keys:

- `pack.id`
- `pack.version`
- `workflow.execution_tier`
- `action.operation`

When exported to Prometheus-style labels these map to:

- `pack_id`
- `pack_version`
- `workflow_execution_tier`
- `action_operation`
