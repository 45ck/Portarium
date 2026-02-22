# OTel Production Pipeline v1

## Purpose

Define the OpenTelemetry Collector pipeline configuration for Portarium's
production observability stack: traces → Tempo, metrics → Prometheus, logs → Loki,
with cross-signal correlation and alerting via AlertManager.

## Spec alignment

ADR-0056 (Infrastructure Reference Architecture), bead-0393 (SLO definitions),
bead-0428 (OTel production pipeline implementation).

## Requirements

### Signals and backends

| Signal  | Local backend      | Production backend          |
| ------- | ------------------ | --------------------------- |
| Traces  | Tempo (local)      | Tempo / cloud OTLP endpoint |
| Metrics | Prometheus (local) | Mimir / cloud endpoint      |
| Logs    | Loki (local)       | Loki / cloud endpoint       |

### Cross-signal correlation

- `spanmetrics` connector MUST derive RED metrics (rate, errors, duration) from
  traces with exemplar links back to trace IDs.
- `transform/add_trace_id_to_logs` MUST inject `trace_id` and `span_id` into
  log records so logs can be correlated back to traces.
- Grafana datasources MUST configure Tempo → Loki and Tempo → Prometheus links.
- Prometheus exemplar destinations MUST reference the Tempo datasource UID.

### Redaction and privacy

- `attributes/redact` processor MUST run before any exporter on traces and logs.
- `tenant.id` MUST be hashed (not deleted) so traces remain joinable.
- PII fields (`user.email`, `user.ip`, auth headers, `db.statement`) MUST be deleted.

### Alerting

- AlertManager MUST receive alerts from Prometheus rule evaluation.
- Multi-window multi-burn-rate (MWMBR) SLO alerts from
  `infra/otel/alerts/slo-burn-rate-alerts.yaml` MUST be loaded as Prometheus
  rule files.
- Alert routing MUST distinguish `page` (fast burn) from `ticket` (slow burn).

### Resource constraints

- `memory_limiter` processor MUST run first in every pipeline.
- Local stack: limit 256 MiB, spike 64 MiB.

### Testing

- A unit test MUST validate that the collector config YAML includes all required
  pipelines (traces, metrics, logs), the spanmetrics connector, both OTLP
  backends, and the Loki exporter.
- The test reads `infra/otel/collector-config.yaml` and asserts structure.
