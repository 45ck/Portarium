# Spec: Retrieval Release Readiness

**Bead:** bead-0782
**Status:** accepted
**Created:** 2026-02-23

---

## Purpose

Define the release readiness criteria for the Derived Artifacts + Retrieval
MVP milestone. Three areas must be formally bounded before shipping:

1. **Projection lag** — time from `evidence.recorded` event to derived
   artifact availability in SemanticIndex and KnowledgeGraph.
2. **Retrieval performance** — query latency and throughput SLAs.
3. **Cost guardrails** — per-query and per-workspace spending ceilings.

---

## Acceptance criteria

| #   | Criterion                        | Pass condition                                                               |
| --- | -------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Projection lag SLA documented    | `docs/governance/retrieval-release-readiness.md` contains lag SLA table      |
| 2   | Retrieval latency SLA documented | Document contains p50/p95/p99 thresholds per strategy                        |
| 3   | Cost guardrails documented       | Document contains per-embedding and per-workspace cost ceilings              |
| 4   | Rollback procedure referenced    | Document references rollback triggers and recovery steps                     |
| 5   | All source artifacts present     | Domain contracts, application services, and infra adapters all exist         |
| 6   | All test artifacts present       | Contract tests for projector, retrieval router, and infra adapters all exist |

---

## Required artifacts

| Artifact                    | Path                                                                  |
| --------------------------- | --------------------------------------------------------------------- |
| Domain contracts            | `src/domain/derived-artifacts/retrieval-ports.ts`                     |
| Domain model                | `src/domain/derived-artifacts/derived-artifact-v1.ts`                 |
| Projector service           | `src/application/services/derived-artifact-projector.ts`              |
| Retrieval query router      | `src/application/services/retrieval-query-router.ts`                  |
| JetStream projection worker | `src/infrastructure/eventing/jetstream-projection-worker.ts`          |
| pgvector adapter            | `src/infrastructure/pgvector/pgvector-semantic-index-adapter.ts`      |
| JanusGraph adapter          | `src/infrastructure/janusgraph/janusgraph-knowledge-graph-adapter.ts` |
| Derived artifact registry   | `src/infrastructure/postgresql/postgres-derived-artifact-registry.ts` |
| Release readiness doc       | `docs/governance/retrieval-release-readiness.md`                      |
| Campaign how-to             | `docs/how-to/derived-artifacts-retrieval-campaign.md`                 |
| ADR-0079                    | `docs/adr/0079-derived-artifacts-retrieval-rag-vector-graph.md`       |
