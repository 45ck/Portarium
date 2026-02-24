# Retrieval Release Readiness

**Bead:** bead-0782
**Status:** accepted
**Reviewed:** 2026-02-23

This document defines the production-readiness criteria for the Derived
Artifacts + Retrieval MVP milestone. All three guardrail areas must be
documented and bounded before the milestone is considered shippable.

---

## 1. Projection Lag SLA

Projection lag is the end-to-end time from a `portarium.events.evidence.recorded`
JetStream event being published until the corresponding derived artifact is
queryable via `SemanticIndexPort` and/or `KnowledgeGraphPort`.

### Architecture

```
EvidenceEntry recorded
        │
        ▼
NATS JetStream (at-least-once delivery)
        │
        ▼
JetstreamProjectionWorker
  - batch: up to 50 messages per fetch
  - fetch expires: 2 000 ms (idle timeout before next batch)
  - ack on successful projection
  - nak on failure (re-delivery with backoff)
        │
        ▼
DerivedArtifactProjectorService
  - idempotent via checkpoint (last processed evidenceId in Postgres)
  - skips already-projected evidenceIds
        │
        ├──▶ SemanticIndexPort (pgvector/Weaviate upsert)
        └──▶ KnowledgeGraphPort (JanusGraph/Neo4j upsert)
```

### Lag SLA table

| Scenario                         | p50 target  | p95 target  | p99 target  |
| -------------------------------- | ----------- | ----------- | ----------- |
| Normal operation (steady state)  | ≤ 500 ms    | ≤ 2 000 ms  | ≤ 5 000 ms  |
| Burst (100 events in < 1 s)      | ≤ 2 000 ms  | ≤ 8 000 ms  | ≤ 15 000 ms |
| Post-restart checkpoint recovery | ≤ 10 000 ms | ≤ 30 000 ms | ≤ 60 000 ms |

### Measurement

Lag is measured as: `artifact.createdAtIso` − `evidence.createdAtIso` for
the first artifact produced from that evidence entry.

### Rollback trigger

If p95 projection lag exceeds **2× the normal target for 5 consecutive
minutes**, disable the JetStream projection worker and open a SEV-2 incident.
See rollback procedure in [Rollback Triggers](#4-rollback-triggers).

---

## 2. Retrieval Performance SLA

The retrieval query router dispatches to three strategies: `semantic` (vector
search), `graph` (entity traversal), and `hybrid` (vector + graph + keyword).

### Latency SLA table

| Strategy   | topK    | p50 target | p95 target | p99 target |
| ---------- | ------- | ---------- | ---------- | ---------- |
| `semantic` | 10      | ≤ 50 ms    | ≤ 200 ms   | ≤ 500 ms   |
| `semantic` | 100     | ≤ 150 ms   | ≤ 500 ms   | ≤ 1 000 ms |
| `graph`    | depth 2 | ≤ 100 ms   | ≤ 400 ms   | ≤ 800 ms   |
| `graph`    | depth 4 | ≤ 500 ms   | ≤ 2 000 ms | ≤ 4 000 ms |
| `hybrid`   | 10      | ≤ 200 ms   | ≤ 800 ms   | ≤ 2 000 ms |

Latencies are measured at the `RetrievalQueryRouter` boundary (wall-clock
time from router entry to first result byte returned).

### Throughput SLA

| Strategy   | Minimum sustained QPS (per workspace) |
| ---------- | ------------------------------------- |
| `semantic` | 20 QPS                                |
| `graph`    | 10 QPS                                |
| `hybrid`   | 5 QPS                                 |

### Rollback trigger

If p95 retrieval latency exceeds **3× the target for 5 consecutive minutes**,
disable the retrieval API endpoint (`/v1/retrieval/query`) and open a SEV-2
incident.

---

## 3. Cost Guardrails

### Embedding cost ceiling

| Metric                                  | Ceiling        | Action on breach                       |
| --------------------------------------- | -------------- | -------------------------------------- |
| Tokens per evidence entry               | ≤ 8 192 tokens | Truncate + log warning                 |
| OpenAI embedding cost per 1 000 entries | ≤ USD 0.10     | Alert on-call; pause projector if > 2× |
| Monthly embedding spend per workspace   | ≤ USD 50       | Hard cap via CloudWatch/Datadog alarm  |

### Storage cost ceiling

| Component                | Ceiling per workspace | Action on breach                            |
| ------------------------ | --------------------- | ------------------------------------------- |
| pgvector rows            | 10 million entries    | Alert at 80%; block new projections at 100% |
| Neo4j/JanusGraph nodes   | 5 million nodes       | Alert at 80%; block new projections at 100% |
| Neo4j/JanusGraph edges   | 20 million edges      | Alert at 80%; block new projections at 100% |
| PostgreSQL registry rows | 50 million entries    | Alert at 80%; archive old checkpoints       |

### Monthly budget alarm

A CloudWatch/Datadog composite alarm must be configured at:

- **WARNING** (80% of monthly budget): notify `#platform-oncall` Slack channel.
- **CRITICAL** (100% of monthly budget): page on-call; pause all embedding
  calls for the workspace that breached the ceiling; log `COST_CEILING_BREACH`
  to the audit trail.

---

## 4. Rollback Triggers

| #   | Trigger                                    | Severity | Scope                     | Action                                                                                     |
| --- | ------------------------------------------ | -------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| R1  | Projection lag p95 > 2× SLA for 5 min      | High     | L1: projection worker     | Stop JetStream worker; drain in-flight; re-enable after fix                                |
| R2  | Retrieval p95 latency > 3× SLA for 5 min   | High     | L1: retrieval endpoint    | Disable `/v1/retrieval/query`; restore after fix                                           |
| R3  | Cross-workspace artifact leak detected     | Critical | L2: full retrieval system | Disable all retrieval endpoints; audit workspace_id scoping; re-enable after fix and audit |
| R4  | Embedding cost breach > 2× monthly ceiling | High     | L1: embedding calls       | Pause embedding projections for breaching workspace; alert finance                         |
| R5  | Contract test suite failure in CI          | High     | L2: deploy gate           | Block deployment; fix contract tests before re-enabling                                    |

### L1 rollback steps (projection worker)

1. Set `PORTARIUM_PROJECTION_WORKER_ENABLED=false` env var.
2. Drain remaining in-flight JetStream acks (max 30 s).
3. Confirm JetStream consumer lag metric returns to pre-failure baseline.
4. Fix root cause (lag, cost, or correctness issue).
5. Re-enable worker; monitor lag SLA for 10 min before closing incident.

### L2 rollback steps (retrieval system)

1. Remove retrieval route from load balancer or set `PORTARIUM_RETRIEVAL_ENABLED=false`.
2. Confirm no active retrieval connections in metrics.
3. Audit `workspace_id` filters on all affected queries.
4. Fix root cause; re-enable under feature flag for one test workspace.
5. Promote to all workspaces after 30-min soak test.

---

## 5. Release Gate Criteria

All of the following must be true before the Derived Artifacts + Retrieval
MVP is considered shippable:

- [ ] `npm run ci:pr` exits 0 (all tests, lint, typecheck pass).
- [ ] `npm run audit:high` exits 0 (no high/critical vulnerability).
- [ ] All contract tests in `retrieval-release-readiness.test.ts` are green.
- [ ] Projection lag SLA table is present in this document.
- [ ] Retrieval latency SLA table is present in this document.
- [ ] Cost guardrail table is present in this document.
- [ ] Rollback triggers table is present in this document.
- [ ] All source artifacts listed in the spec exist on disk.
- [ ] All test artifacts listed in the spec exist on disk.

---

## 6. Required Artifacts

| Category                    | Path                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| Domain contracts            | `src/domain/derived-artifacts/retrieval-ports.ts`                                         |
| Domain model                | `src/domain/derived-artifacts/derived-artifact-v1.ts`                                     |
| Projector service           | `src/application/services/derived-artifact-projector.ts`                                  |
| Retrieval query router      | `src/application/services/retrieval-query-router.ts`                                      |
| JetStream projection worker | `src/infrastructure/eventing/jetstream-projection-worker.ts`                              |
| pgvector adapter            | `src/infrastructure/pgvector/pgvector-semantic-index-adapter.ts`                          |
| JanusGraph adapter          | `src/infrastructure/janusgraph/janusgraph-knowledge-graph-adapter.ts`                     |
| Derived artifact registry   | `src/infrastructure/postgresql/postgres-derived-artifact-registry.ts`                     |
| Projector tests             | `src/application/services/derived-artifact-projector.test.ts`                             |
| Retrieval router tests      | `src/application/services/retrieval-query-router.test.ts`                                 |
| Redactor tests              | `src/application/services/derived-artifact-redactor.test.ts`                              |
| JetStream worker tests      | `src/infrastructure/eventing/jetstream-projection-worker.test.ts`                         |
| pgvector adapter tests      | `src/infrastructure/pgvector/pgvector-semantic-index-adapter.test.ts`                     |
| JanusGraph adapter tests    | `src/infrastructure/janusgraph/janusgraph-knowledge-graph-adapter.test.ts`                |
| Postgres registry tests     | `src/infrastructure/postgresql/postgres-derived-artifact-registry.test.ts`                |
| Retrieval integration tests | `src/application/integration/retrieval-replay-idempotency-provenance.integration.test.ts` |
| Domain model tests          | `src/domain/derived-artifacts/derived-artifact-v1.test.ts`                                |
| Domain ports tests          | `src/domain/derived-artifacts/retrieval-ports.test.ts`                                    |
| ADR-0079                    | `docs/internal/adr/0079-derived-artifacts-retrieval-rag-vector-graph.md`                  |
| Campaign how-to             | `docs/how-to/derived-artifacts-retrieval-campaign.md`                                     |
| License gate                | `docs/compliance/vector-graph-embedding-license-gate.md`                                  |
| Release readiness spec      | `.specify/specs/retrieval-release-readiness-v1.md`                                        |
