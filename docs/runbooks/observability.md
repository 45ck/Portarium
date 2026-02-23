# Observability Runbook

Portarium control plane emits structured logs, Prometheus metrics, and OTel traces.

## Structured Logs

All control plane log lines are newline-delimited JSON written to stdout (info/debug) or stderr (warn/error).

**Log entry schema:**

| Field           | Type    | Description                                                         |
| --------------- | ------- | ------------------------------------------------------------------- |
| `level`         | string  | `debug`, `info`, `warn`, or `error`                                 |
| `time`          | number  | Unix epoch milliseconds                                             |
| `name`          | string  | Logger name (e.g. `control-plane`, `execution-plane`)               |
| `msg`           | string  | Human-readable message                                              |
| `traceId`       | string? | Active OTel trace ID (present when a span is active)                |
| `correlationId` | string? | Request correlation ID (auto-injected by request-scoped logger)     |
| `traceparent`   | string? | W3C traceparent from inbound request (request-scoped)               |
| `workspaceId`   | string? | Workspace ID from request context (request-scoped)                  |
| `userId`        | string? | User ID from request context (request-scoped, after authentication) |
| `method`        | string? | HTTP method (request-scoped)                                        |
| `path`          | string? | Request path (request-scoped)                                       |
| `status`        | number? | Response status code (on request-completion log lines)              |
| `durationMs`    | number? | Request duration in ms (on request-completion log lines)            |
| `route`         | string? | Matched route pattern (on request-completion log lines)             |

**Querying logs in Loki (via Grafana):**

```logql
# All errors from control plane
{service="portarium-control-plane"} | json | level="error"

# Logs for a specific trace
{service="portarium-control-plane"} | json | traceId="<traceId>"

# Logs for a specific correlation ID
{service="portarium-control-plane"} | json | correlationId="<correlationId>"

# Request completion logs for a specific workspace
{service="portarium-control-plane"} | json | msg="request completed" | workspaceId="<id>"

# Slow requests (> 1 second)
{service="portarium-control-plane"} | json | msg="request completed" | durationMs > 1000

# Rate-limit rejections (logged at warn level)
{service="portarium-control-plane"} | json | level="warn" | msg=~"rate.limit"
```

## Prometheus Metrics (`/metrics`)

The control plane exposes Prometheus metrics at `GET /metrics` on its HTTP port (default 8080).

**Metrics reference:**

| Metric                                    | Type      | Labels                      | Description                 |
| ----------------------------------------- | --------- | --------------------------- | --------------------------- |
| `portarium_http_requests_total`           | counter   | `method`, `route`, `status` | Total HTTP requests         |
| `portarium_http_request_duration_seconds` | histogram | `method`, `route`           | Request duration in seconds |
| `portarium_http_active_connections`       | gauge     | —                           | Requests in flight          |
| `portarium_rate_limit_hits_total`         | counter   | `workspaceId`               | Rate-limited requests       |
| `portarium_cache_hits_total`              | counter   | `result`                    | Cache hits and misses       |

**Useful PromQL queries:**

```promql
# Request rate (req/s) by route
rate(portarium_http_requests_total[5m])

# 95th-percentile latency
histogram_quantile(0.95, rate(portarium_http_request_duration_seconds_bucket[5m]))

# Error rate (4xx/5xx)
rate(portarium_http_requests_total{status=~"[45].."}[5m])
  / rate(portarium_http_requests_total[5m])

# Active connections
portarium_http_active_connections

# Rate limit hits per workspace
topk(10, rate(portarium_rate_limit_hits_total[10m]))
```

## Distributed Traces

Spans are emitted via OTel (OTLP/HTTP to the collector at `OTEL_EXPORTER_OTLP_ENDPOINT`, default `http://localhost:4318`).

**Instrumented operations:**

| Span name                  | Operation                                                           |
| -------------------------- | ------------------------------------------------------------------- |
| `app.command.<name>`       | Every application command execution (via `observeCommandExecution`) |
| `db.query`                 | Every Postgres query via `NodePostgresSqlClient.query()`            |
| `db.transaction`           | Postgres transactions via `NodePostgresSqlClient.withTransaction()` |
| `openfga.check`            | Every OpenFGA authorization check                                   |
| `nats.publish`             | Every NATS JetStream publish                                        |
| `temporal.activity.<name>` | Temporal activity spans (via `observeTemporalSpan`)                 |

**Querying traces in Tempo (via Grafana Explore):**

1. Select data source: **Tempo**
2. Query by trace ID: paste the `traceId` from a log entry
3. Or use TraceQL to search:

```traceql
# Slow Postgres queries (> 500 ms)
{ span.name = "db.query" && duration > 500ms }

# Failed OpenFGA checks
{ span.name = "openfga.check" && status = error }

# All spans for a workspace
{ resource.service.name = "portarium-control-plane" && span.workspaceId = "<id>" }
```

**Trace context propagation:**

Inbound W3C `traceparent` / `tracestate` headers are extracted and injected into the active OTel context. All child spans within a request share the same trace ID. Both the control plane and execution plane call `initializeOtel()` at startup to configure the SDK.

## Alerts

Recommended alert thresholds (configure in Grafana Alerting or your alertmanager):

| Alert            | Expression                                                                                         | Threshold         |
| ---------------- | -------------------------------------------------------------------------------------------------- | ----------------- |
| High error rate  | `rate(portarium_http_requests_total{status=~"5.."}[5m]) / rate(portarium_http_requests_total[5m])` | > 1% for 5 min    |
| High p95 latency | `histogram_quantile(0.95, rate(portarium_http_request_duration_seconds_bucket[5m]))`               | > 2s for 5 min    |
| Rate limit storm | `rate(portarium_rate_limit_hits_total[1m])`                                                        | > 100/s for 2 min |
| No scrape        | `up{job="portarium-control-plane"} == 0`                                                           | 0 for 2 min       |

## Environment Variables

| Variable                      | Default                   | Description                        |
| ----------------------------- | ------------------------- | ---------------------------------- |
| `OTEL_SERVICE_NAME`           | `portarium-control-plane` | Service name in traces and metrics |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318`   | OTel collector OTLP/HTTP endpoint  |
| `PORTARIUM_OTEL_ENABLED`      | `true`                    | Set to `false` to disable OTel     |
| `PORTARIUM_HTTP_PORT`         | `8080`                    | HTTP port (also serves `/metrics`) |
