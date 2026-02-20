# Migration Phase 1: Visibility

**Bead:** bead-0690
**Date:** 2026-02-21

## Objective

Instrument all agent processes so that every outbound HTTP call is logged and
classified as either "control-plane-routed" or "direct-sor-call." This
provides the data needed to plan the next migration phases without changing
any runtime behavior.

## Prerequisites

- [ ] Portarium control plane deployed and accessible.
- [ ] Agents running in a workspace with network access to SoR endpoints.
- [ ] Log aggregation pipeline (e.g., Loki, Elasticsearch) operational.

## Steps

### 1. Install the side-effect logger

Wrap the agent's HTTP client with `AgentSideEffectLogger`:

```typescript
import { AgentSideEffectLogger } from '@portarium/infrastructure/observability/agent-side-effect-logger';

const logger = new AgentSideEffectLogger({
  controlPlaneBaseUrls: ['https://api.portarium.example.com'],
  agentId: 'agent-invoicing-01',
  workspaceId: 'ws-production',
});

// Replace direct fetch calls:
const response = await logger.instrumentedFetch(url, init);
```

### 2. Configure log sink

By default the logger writes JSON to stdout. For structured log aggregation,
implement a custom `SideEffectLogSink`:

```typescript
import type { SideEffectLogSink } from '@portarium/infrastructure/observability/agent-side-effect-logger';

const otlpSink: SideEffectLogSink = {
  write(entry) {
    // Forward to OTLP collector or structured logging framework.
    opentelemetry.logs.emit(entry);
  },
};
```

### 3. Verify trace context propagation

Confirm that outbound requests carry W3C Trace Context headers:

```bash
# Inspect headers on a sample request
curl -v https://api.portarium.example.com/api/v1/runs 2>&1 | grep traceparent
# Expected: traceparent: 00-<trace-id>-<span-id>-01
```

### 4. Build visibility dashboard

Create a dashboard with the following panels:

| Panel                          | Query / metric                                     |
| ------------------------------ | -------------------------------------------------- |
| Total outbound calls           | `count(side_effect_log_entries)`                   |
| Classification breakdown       | `group by classification`                          |
| Direct SoR calls (trend)       | `count where classification = "direct-sor-call"`   |
| Routing compliance %           | `routed / total * 100`                             |
| Top direct SoR endpoints       | `group by url where classification = "direct-sor-call"` |
| Latency by classification      | `avg(durationMs) group by classification`          |

### 5. Set alerting thresholds

| Alert                         | Threshold                     | Severity |
| ----------------------------- | ----------------------------- | -------- |
| New direct SoR endpoint seen  | Any new URL pattern           | Info     |
| Direct SoR calls > 50% total | > 50% over 1h window          | Warning  |
| Trace context missing         | Any call without traceparent  | Warning  |

## Validation

- [ ] All agent processes emit structured log entries with classification.
- [ ] Dashboard shows real-time breakdown of routed vs. direct calls.
- [ ] No runtime behavior changes -- agents continue operating normally.
- [ ] W3C traceparent headers present on all outbound requests.

## Rollback

This phase is purely additive (logging middleware). To rollback:

1. Remove or disable the `AgentSideEffectLogger` wrapper.
2. Agents revert to direct `fetch` calls without logging.
3. No data loss or behavior change.

## Next phase

Once visibility data confirms the scope of direct SoR calls, proceed to
**Phase 2: Credential Relocation** (`migration-phase2-credential-relocation.md`).
