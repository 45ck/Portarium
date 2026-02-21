# ADR-0079: Derived Artifacts and Retrieval Architecture (RAG + Vector + Graph)

<!-- cspell:ignore replayable -->

**Beads:** bead-0765
**Status:** Accepted
**Date:** 2026-02-21

## Context

Portarium needs governed semantic retrieval and relationship-aware query capabilities for
operator workflows, agent support, and cockpit discovery. The existing architecture already
establishes:

- PostgreSQL + Evidence payload store as system of record.
- CloudEvents outbox + NATS JetStream for replay-enabled event distribution.
- Ports-and-adapters boundaries that keep provider choices in infrastructure.
- Strong workspace/tenant policy, privacy, and evidence integrity constraints.

The new retrieval capability must preserve these properties:

- System-of-record correctness remains in Portarium stores.
- Derived stores are rebuildable and idempotent.
- Responses include provenance back to Evidence/Run identifiers.
- Retention and legal-hold controls apply to derived artifacts.

## Decision

Adopt an asynchronous projection architecture for derived artifacts and retrieval.

1. Keep Portarium SoR authoritative

- PostgreSQL and Evidence payload store remain source of truth for correctness and audit.
- Vector and graph stores are derived read models only.

2. Build projections from replay-capable CloudEvents

- A projection worker consumes JetStream events (at-least-once semantics).
- Projectors are idempotent with checkpoint storage and deterministic replay behavior.
- Reindex/rebuild is supported without mutating SoR records.

3. Introduce provider-agnostic ports

- `SemanticIndexPort`
- `KnowledgeGraphPort`
- `ProjectionCheckpointPort`
- `EmbeddingProviderPort`

Adapters are wired at runtime through environment-driven dependency selection.

4. Adopt primary retrieval stack with fallback path

- Primary vector backend: Weaviate adapter.
- Primary graph backend: Neo4j adapter.
- Fallback vector path: PostgreSQL vector extension or managed/vector parity option.
- Fallback graph path: JanusGraph parity option.

5. Enforce provenance-first response model

- Retrieval responses return stable identifiers and evidence links.
- Cockpit/API results include evidence/run provenance fields and correlation metadata.

6. Apply security, privacy, and retention rules to derived artifacts

- Embedding/index input surfaces are sanitized and policy-validated.
- Workspace/tenant isolation is enforced at API, query, and adapter boundaries.
- Derived artifacts participate in retention/hold handling and disposition workflows.

## Consequences

Positive:

- Clear separation of correctness (SoR) from fast retrieval (derived stores).
- Deterministic rebuild/replay supports operational recovery and migration.
- Provider swap risk is reduced by stable ports/adapters.
- Provenance-first responses align with governance and audit expectations.

Negative:

- Additional operational surface area (vector + graph + projector pipeline).
- Eventual consistency between SoR writes and retrieval read models.
- Added complexity for retention propagation and reindex workflows.

## Alternatives Considered

- Request-path synchronous indexing:
  - Rejected due to user-facing latency and coupling risk to provider availability.
- Single-store only (no dedicated vector/graph):
  - Deferred for MVP-only simplicity path; limits semantic and relationship retrieval quality.
- Direct agent/provider access bypassing control plane:
  - Rejected for governance, auditability, and credential-boundary violations.

## Rollback Strategy

- Feature-flag retrieval endpoints and projector workers.
- Stop projector consumers without affecting SoR correctness.
- Rebuild derived stores from retained CloudEvents + authoritative records.
- Disable provider adapters and return controlled "retrieval unavailable" responses.

## Implementation Mapping

This ADR is implemented/planned through:

- `bead-0764` campaign umbrella
- `bead-0766` API/spec contracts for retrieval routes
- `bead-0768` domain/application port contracts
- `bead-0769` derived artifact invariants and retention mapping
- `bead-0770` projector orchestration + idempotency
- `bead-0771` retrieval routing and provenance assembly
- `bead-0774` Weaviate adapter
- `bead-0775` Neo4j adapter
- `bead-0776` fallback vector parity spike
- `bead-0777` fallback graph parity spike
- `bead-0778` presentation retrieval routes
- `bead-0779` cockpit retrieval UX
- `bead-0780` security controls
- `bead-0781` end-to-end verification
- `bead-0782` migration and rollout
- `bead-0783` release gate and rollback validation

## Acceptance Evidence

- ADR document: `docs/adr/0079-derived-artifacts-retrieval-rag-vector-graph.md`
- Claimed bead record: `.beads/issues.jsonl` entry for `bead-0765`
