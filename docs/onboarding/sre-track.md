# SRE / Platform Engineer Onboarding Track

**Audience:** Platform engineers deploying, operating, and monitoring Portarium.
**Time:** ~45 minutes.

---

## Learning Objectives

- Understand the runtime topology (control plane, execution plane, Temporal).
- Run the CI runnable-state smoke pipeline locally.
- Configure health checks and readiness probes.
- Interpret evidence chain gaps and alert on chain breaks.

---

## Track Steps

### 1. Runtime Topology Overview (5 min read)

Portarium has two runtime roles:

| Role              | Container env var                          | Port | Responsibility                             |
| ----------------- | ------------------------------------------ | ---- | ------------------------------------------ |
| `control-plane`   | `PORTARIUM_CONTAINER_ROLE=control-plane`   | 8080 | HTTP API, workflow orchestration           |
| `execution-plane` | `PORTARIUM_CONTAINER_ROLE=execution-plane` | 7000 | Machine/agent heartbeats, adapter dispatch |

Both roles are built from the same image; the env var selects the entry point.

### 2. Local Stack Smoke Test (10 min)

```bash
npm run test -- src/infrastructure/adapters/runnable-state-ci.test.ts
```

All 29 tests should pass. These tests cover:

- Schema migration dry-run (expand phase)
- Control plane health endpoints
- Machine + agent registration
- Evidence chain integrity

### 3. Health Probes (5 min)

```bash
# Liveness
curl http://localhost:8080/health/live

# Readiness
curl http://localhost:8080/health/ready

# Startup
curl http://localhost:8080/health/startup
```

All return `{ status: "ok" }` when healthy. Map to Kubernetes probes:

```yaml
livenessProbe:
  httpGet: { path: /health/live, port: 8080 }
  initialDelaySeconds: 5
readinessProbe:
  httpGet: { path: /health/ready, port: 8080 }
  initialDelaySeconds: 10
```

### 4. Evidence Chain Monitoring (10 min)

Evidence chain breaks indicate tampered or dropped records. Alert when:

```bash
# CLI verify (once SDK CLI is available)
portarium evidence verify --workspace ws-prod --since 24h

# Or via the SDK verifier
node -e "
const { verifyEvidenceChain, sha256Hex } = await import('./src/sdk/evidence-chain-verifier.js');
const entries = await fetchEntries(); // your log store
const r = verifyEvidenceChain(entries, { computeHash: sha256Hex });
if (!r.ok) process.exit(1);
"
```

### 5. Database Migration Runbook (10 min read)

```bash
# Check migration status
npm run migrate:check

# Dry-run expand phase (safe for prod)
npm run migrate:dry-run:expand

# Deploy expand migrations
npm run migrate:deploy
```

Never run contract migrations without a maintenance window.

### 6. Observability (5 min read)

- OpenTelemetry traces: set `OTEL_EXPORTER_OTLP_ENDPOINT` to your collector.
- Correlation IDs: every request sets `x-correlation-id`; forward it in all logs.
- Structured JSON logging is enabled by default in production mode.

---

## Checklist

- [ ] All `runnable-state-ci.test.ts` tests pass locally.
- [ ] Health probe endpoints return 200.
- [ ] `npm run migrate:check` shows no pending migrations.
- [ ] OpenTelemetry endpoint is configured in your deployment manifest.
