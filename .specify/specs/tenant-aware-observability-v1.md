# Tenant-Aware Observability v1

## Purpose

Defines how Portarium's multi-tenant architecture surfaces per-tenant observability without leaking data across workspace boundaries. The OTel collector routes, tags, and retains telemetry based on workspace/tenant identity.

## Design Principles

1. **Tenant isolation in telemetry:** Traces, metrics, and logs are tagged with `workspace.id` as a resource attribute. Query-time filtering enforces that operators see only their workspace data.
2. **Privacy-safe export:** The `tenant.id` attribute is hashed (not deleted) in the collector pipeline so traces remain joinable without exposing raw tenant identifiers to external backends.
3. **Configurable retention:** Retention policies are defined per tenant tier (free, standard, enterprise) to control storage costs.
4. **No cross-tenant aggregation by default:** Dashboards scope queries by `workspace.id`. Platform-wide aggregation requires explicit operator role.

## Resource Attributes

Every span, metric, and log record from Portarium components MUST include:

| Attribute                | Source           | Description                                         |
| ------------------------ | ---------------- | --------------------------------------------------- |
| `service.name`           | env / config     | Component name (e.g., `portarium-control-plane`)    |
| `service.namespace`      | collector        | Always `portarium` (set by resource processor)      |
| `workspace.id`           | application code | Workspace/tenant identifier for the current request |
| `deployment.environment` | env              | `dev`, `staging`, `prod`                            |

## Collector Routing

The OTel collector uses attribute-based routing to direct telemetry:

### Per-Tenant Processing

```yaml
# infra/otel/tenant-routing-processor.yaml
processors:
  routing/tenant:
    from_attribute: workspace.id
    table:
      - value: '*'
        exporters: [otlp/default]
    default_exporters: [otlp/default]
```

In production deployments, the routing table can map specific high-volume tenants to dedicated exporters/storage backends.

### Attribute-Based Filtering

Downstream consumers (Grafana, alerting) use `workspace.id` as a mandatory label:

- Dashboard variables: `$workspace` filter on `workspace.id`
- Alert rules: scoped to `workspace.id` to prevent noisy-neighbor alerts
- Log queries: filtered by `workspace.id` in Loki/similar

## Retention Policy Schema

Per-tenant retention is configured via a JSON schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "workspaceId": { "type": "string" },
    "tier": { "enum": ["free", "standard", "enterprise"] },
    "traces": {
      "type": "object",
      "properties": {
        "retentionDays": { "type": "integer", "minimum": 1, "maximum": 365 }
      },
      "required": ["retentionDays"]
    },
    "metrics": {
      "type": "object",
      "properties": {
        "retentionDays": { "type": "integer", "minimum": 1, "maximum": 365 }
      },
      "required": ["retentionDays"]
    },
    "logs": {
      "type": "object",
      "properties": {
        "retentionDays": { "type": "integer", "minimum": 1, "maximum": 365 }
      },
      "required": ["retentionDays"]
    }
  },
  "required": ["workspaceId", "tier", "traces", "metrics", "logs"]
}
```

### Default Retention by Tier

| Tier       | Traces  | Metrics  | Logs    |
| ---------- | ------- | -------- | ------- |
| free       | 7 days  | 30 days  | 7 days  |
| standard   | 30 days | 90 days  | 30 days |
| enterprise | 90 days | 365 days | 90 days |

## Implementation Files

- `infra/otel/collector-config.yaml` -- Base collector pipeline with redaction.
- `infra/otel/tenant-routing-processor.yaml` -- Tenant-aware routing snippet.
- `src/infrastructure/observability/otel-setup.ts` -- Node.js SDK initialization.

## Invariants

1. Every outbound span MUST include `workspace.id` when the request is workspace-scoped.
2. The collector MUST hash `tenant.id` before exporting to external backends.
3. Retention enforcement is the responsibility of the storage backend (Tempo, Loki, Mimir), not the collector.
4. Platform operators MUST NOT query cross-tenant data without explicit authorization.
