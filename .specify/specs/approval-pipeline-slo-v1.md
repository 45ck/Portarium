# Approval Pipeline SLO v1

**Status**: Draft
**Bead**: bead-0911
**Owner**: Portarium Platform Team
**Date**: 2026-03-10

---

## Overview

This document defines Service Level Objectives (SLOs) for the Portarium approval pipeline:
`proposeAgentAction` → `submitApproval` → `executeApprovedAgentAction`.

These SLOs apply to the **application-layer command handlers** running against in-memory
adapters (no real DB or network overhead). They represent the baseline computation
budget before infrastructure costs are added. Production P95 budgets should be set
at most at `SLO_p95_ms + expected_infrastructure_overhead_ms`.

---

## Definitions

- **p50**: Median latency (50th percentile of all call durations).
- **p95**: 95th-percentile latency. The primary SLO gate.
- **p99**: 99th-percentile latency. Monitored but not a hard gate.
- **Concurrency**: Number of concurrent calls issued simultaneously.
- **In-memory**: All adapters are pure in-process; no DB, no network.

---

## SLO Table

| Stage                        | Concurrency | p50 target | p95 target | p99 target |
| ---------------------------- | ----------- | ---------- | ---------- | ---------- |
| `proposeAgentAction`         | 50          | ≤ 5 ms     | ≤ 50 ms    | ≤ 100 ms   |
| `submitApproval`             | 50          | ≤ 5 ms     | ≤ 50 ms    | ≤ 100 ms   |
| `executeApprovedAgentAction` | 50          | ≤ 5 ms     | ≤ 50 ms    | ≤ 100 ms   |
| **Full pipeline** (all 3)    | 50          | ≤ 20 ms    | ≤ 150 ms   | ≤ 300 ms   |

### Rationale for p95 = 50 ms per stage

- Application logic is synchronous/in-process with no I/O.
- Policy evaluation, evidence hashing, and event serialisation together should
  complete in single-digit milliseconds for typical payloads.
- A 50 ms p95 budget provides a 10× headroom above the p50 target to absorb
  occasional GC pauses and event-loop contention under concurrent load.
- The full-pipeline 150 ms p95 accounts for three sequential stages plus minor
  coordination overhead.

---

## Measurement methodology

Performance tests are located at:

```
src/application/commands/propose-agent-action.perf.test.ts
```

The tests:

1. Instantiate all adapters as pure in-memory stubs.
2. Issue N=50 concurrent calls via `Promise.all`.
3. Record the wall-clock duration of each call.
4. Compute p50/p95/p99 from the recorded samples.
5. Assert that p95 is within the SLO threshold defined in this document.

Tests use `describe.skipIf(process.env['CI_PERF_SKIP'])` so they can be
excluded from standard CI runs where timing guarantees are unreliable (e.g.,
heavily-loaded CI runners). To run locally: `npx vitest run --reporter=verbose`.

---

## Operational SLOs (production)

The in-memory SLOs above inform, but do not replace, production SLOs. When
PostgreSQL and Redis are wired in, additional budgets apply:

| Stage                        | p95 target (production) |
| ---------------------------- | ----------------------- |
| `proposeAgentAction`         | ≤ 200 ms                |
| `submitApproval`             | ≤ 200 ms                |
| `executeApprovedAgentAction` | ≤ 500 ms                |
| **Full pipeline**            | ≤ 900 ms                |

---

## Alerting thresholds

| Metric                      | Warning  | Critical   |
| --------------------------- | -------- | ---------- |
| Proposal p95 latency        | > 150 ms | > 500 ms   |
| Approval submit p95 latency | > 150 ms | > 500 ms   |
| Execute action p95 latency  | > 400 ms | > 1 000 ms |
| Pipeline error rate (5 min) | > 1%     | > 5%       |

---

## Review cadence

SLOs are reviewed quarterly or when a new adapter (DB backend, cache, queue) is
introduced. Any change to these thresholds requires an ADR entry.
