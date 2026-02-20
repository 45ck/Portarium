# Migration Phase 1: Visibility Runbook

**Beads:** bead-0651 (bead-0690 original reference)
**Status:** Draft
**Date:** 2026-02-21
**Prerequisites:** None (first phase)

## Objective

Instrument existing agents and automations with observability hooks so that Portarium
can measure the current state of direct SoR access patterns. This phase makes no
enforcement changes -- it only adds visibility.

## Success Criteria

- All agents emit W3C Trace Context headers on outbound HTTP calls
- Side-effect attempts are logged with structured metadata
- Baseline metrics established: direct-SoR-call count, agent inventory, SoR inventory

## Runbook Steps

### Step 1: Inventory existing agents

1. Enumerate all automation endpoints (scripts, cron jobs, AI agents, RPA bots)
2. Record for each: name, runtime environment, SoRs accessed, auth mechanism used
3. Publish inventory to `docs/governance/agent-inventory.md`

**Verification:** Inventory covers all known automation endpoints.

### Step 2: Add W3C Trace Context headers

For each agent runtime, add `traceparent` and `tracestate` headers to outbound HTTP calls.

**OpenTelemetry SDK (recommended):**

```python
# Python agent example
from opentelemetry import trace
from opentelemetry.instrumentation.requests import RequestsInstrumentor

RequestsInstrumentor().instrument()  # Auto-injects traceparent on requests.Session
```

```typescript
// Node.js agent example
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

const provider = new NodeTracerProvider();
provider.register();
new HttpInstrumentation().enable(); // Auto-injects traceparent on http/https
```

**Manual injection (fallback):**

```
traceparent: 00-{trace-id}-{span-id}-01
```

**Verification:** Sample outbound requests and confirm `traceparent` header is present.

### Step 3: Log side-effect attempts

Add structured logging at the point where agents call external SoRs. Log entries must include:

| Field                  | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| `agent_id`             | Identifier of the calling agent                                     |
| `timestamp`            | ISO 8601 UTC                                                        |
| `target_sor`           | SoR being called (e.g., "hubspot-crm", "odoo-accounting")           |
| `action`               | Operation being performed (e.g., "invoice:create", "ticket:update") |
| `trace_id`             | W3C trace ID from traceparent header                                |
| `routed_via_portarium` | `false` (in phase 1, all calls are direct)                          |

Example log entry:

```json
{
  "level": "info",
  "msg": "side_effect_attempt",
  "agent_id": "sales-bot-01",
  "target_sor": "hubspot-crm",
  "action": "contact:create",
  "trace_id": "abc123...",
  "routed_via_portarium": false
}
```

**Verification:** Structured logs appear in centralized log aggregator (e.g., Loki, ELK).

### Step 4: Establish baseline metrics

Deploy Prometheus metrics or OTLP counters:

| Metric                             | Type    | Labels                                       |
| ---------------------------------- | ------- | -------------------------------------------- |
| `portarium_sor_calls_total`        | Counter | `agent_id`, `target_sor`, `action`, `routed` |
| `portarium_agent_heartbeats_total` | Counter | `agent_id`                                   |
| `portarium_direct_sor_ratio`       | Gauge   | `workspace_id`                               |

**Target baseline:** Record current `portarium_direct_sor_ratio` (expected: ~1.0 in phase 1).

**Verification:** Metrics visible in Grafana dashboard; baseline snapshot captured.

### Step 5: Deploy Portarium telemetry collector

- Deploy OTel Collector sidecar alongside agent runtimes
- Configure collector to forward traces to Portarium telemetry endpoint
- Verify traces appear in Portarium evidence trail

**Verification:** Traces from instrumented agents visible in Portarium workspace.

## Rollback

Phase 1 is additive-only (logging and tracing). Rollback = remove instrumentation
libraries and structured log statements. No data-path changes to reverse.

## Duration Estimate

2-4 weeks depending on agent count and runtime diversity.

## Next Phase

Phase 2: Credential Relocation -- move SoR credentials from agent runtimes to Vault.
