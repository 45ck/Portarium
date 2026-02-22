# otel-collector Helm Chart

Portarium OpenTelemetry Collector — multi-signal observability pipeline.

## Signals

| Signal  | Receiver                      | Exporter                |
| ------- | ----------------------------- | ----------------------- |
| Traces  | OTLP gRPC/HTTP                | Tempo (OTLP gRPC, mTLS) |
| Metrics | OTLP + Prometheus self-scrape | Prometheus remote-write |
| Logs    | OTLP gRPC/HTTP                | Loki (native exporter)  |

Cross-signal correlation: `spanmetrics` derives RED metrics from traces; `transform/add_trace_id_to_logs` injects trace/span IDs into log records.

## Config modes

| Mode     | Use          | Features                                            |
| -------- | ------------ | --------------------------------------------------- |
| `full`   | prod/staging | Tail sampling, spanmetrics, PII redaction, mTLS     |
| `simple` | dev/local    | No tail sampling, debug exporter, insecure backends |

## Deploy

```bash
# Dev (creates Secret from values)
helm upgrade --install otel-collector ./infra/helm/otel-collector \
  -f infra/helm/otel-collector/values-dev.yaml \
  --namespace portarium --create-namespace

# Production (Secret pre-created by Vault/ESO)
helm upgrade --install otel-collector ./infra/helm/otel-collector \
  -f infra/helm/otel-collector/values-prod.yaml \
  --namespace portarium
```

## Required Secret (production)

The `otel-backends` Secret must be created before deploying with `secret.create: false`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: otel-backends
  namespace: portarium
stringData:
  TEMPO_ENDPOINT: 'tempo.monitoring.svc:4317'
  TEMPO_AUTH_TOKEN: '<token>'
  PROM_REMOTE_WRITE_URL: 'https://mimir.monitoring.svc/api/v1/push'
  PROM_AUTH_TOKEN: '<token>'
  LOKI_ENDPOINT: 'http://loki.monitoring.svc:3100/loki/api/v1/push'
  LOKI_AUTH_TOKEN: '<token>'
```

## Bead

bead-0390
