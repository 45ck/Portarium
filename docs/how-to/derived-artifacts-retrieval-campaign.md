# Derived Artifacts + Retrieval Campaign: RAG/Vector/Graph Integration Plan

> **Audience**: Engineering leads, AI/ML engineers, and product owners.
>
> **Goal**: Define the integration plan for enriching Portarium workflows with derived
> artefacts (embeddings, graph projections, semantic indexes) and retrieval capabilities
> (RAG, vector search, graph traversal).

---

## 1. Why derived artefacts?

Governed workflows produce **evidence chains** — tamper-evident logs of what happened.
Derived artefacts transform those logs into _queryable knowledge_:

| Evidence chain                | Derived artefact   | Enables                               |
| ----------------------------- | ------------------ | ------------------------------------- |
| Raw `EvidenceEntryV1` records | Semantic embedding | "Find runs similar to this one"       |
| Run step sequence             | Graph projection   | "What depends on this approval?"      |
| Approval decisions over time  | Time-series index  | "How long do approvals take by tier?" |
| Document attachments (if any) | RAG chunk index    | "What policy governs this workflow?"  |

---

## 2. Architecture overview

```
Evidence store (PostgreSQL / append-only)
        │
        ▼
Projection worker (bead-0773 — JetStream consumer)
        │  streams EvidenceEntryV1 events
        ├──▶ SemanticIndexPort (bead-0774 — Weaviate adapter)
        │       stores embeddings + metadata
        ├──▶ GraphProjectionPort (bead-0775 — Neo4j / in-process adapter)
        │       stores entity–relationship graph
        └──▶ DerivedArtifactRegistry (bead-0772 — SQL migration)
                tracks projection checkpoints
        │
        ▼
Retrieval query router (bead-0771)
        │
        ├──▶ Vector search (semantic similarity)
        ├──▶ Graph query (entity traversal, dependency mapping)
        └──▶ Hybrid retrieval (vector + graph + keyword)
        │
        ▼
API endpoint (bead-0766 — OpenAPI spec)
        │
        └──▶ Cockpit + external API consumers
```

---

## 3. Port families (MIS v0.1 alignment)

| Port                  | MIS family  | Bead                                                |
| --------------------- | ----------- | --------------------------------------------------- |
| `SemanticIndexPort`   | `vector-db` | bead-0774 (Weaviate), bead-0776 (pgvector fallback) |
| `GraphProjectionPort` | `graph-db`  | bead-0775 (Neo4j), bead-0777 (in-process fallback)  |
| `EmbeddingPort`       | `embedding` | bead-0778 (OpenAI), bead-0779 (local ONNX)          |
| `ChunkingPort`        | `chunking`  | bead-0780 (recursive, sentence, BAML-structured)    |

---

## 4. Domain contracts (bead-0768/0769)

### 4.1 DerivedArtifact

```typescript
type DerivedArtifactV1 = Readonly<{
  schemaVersion: 1;
  artifactId: DerivedArtifactId;
  workspaceId: WorkspaceId;
  sourceRunId: RunId;
  sourceEvidenceId: EvidenceId;
  kind: 'embedding' | 'graph-node' | 'graph-edge' | 'chunk-index';
  provenance: DerivedArtifactProvenance;
  createdAtIso: string;
  expiresAtIso?: string; // retention policy
}>;
```

### 4.2 Retrieval query

```typescript
type RetrievalQueryV1 = Readonly<{
  workspaceId: WorkspaceId;
  query: string;
  topK: number;
  strategy: 'semantic' | 'graph' | 'hybrid';
  filters?: {
    runId?: RunId;
    evidenceKind?: string;
    dateRange?: { from: string; to: string };
  };
}>;
```

---

## 5. Campaign milestones

### M0 — Foundations (beads 0767–0769)

- [ ] License gate: all vector/graph/embedding deps are MIT/Apache-compatible (bead-0767)
- [ ] Domain contracts: `DerivedArtifactV1`, `RetrievalQueryV1`, ports (bead-0768)
- [ ] Domain model: invariants, provenance, retention mapping (bead-0769)

### M1 — Application services (beads 0770–0771)

- [ ] Projector orchestration + idempotency (bead-0770)
- [ ] Retrieval query router + provenance assembly (bead-0771)

### M2 — Infrastructure adapters (beads 0772–0780)

- [ ] DB migrations for checkpoint + registry (bead-0772)
- [ ] JetStream projection worker (bead-0773)
- [ ] Weaviate adapter for `SemanticIndexPort` (bead-0774)
- [ ] Neo4j adapter for `GraphProjectionPort` (bead-0775)
- [ ] pgvector fallback (bead-0776)
- [ ] In-process graph fallback (bead-0777)
- [ ] OpenAI embedding adapter (bead-0778)
- [ ] Local ONNX embedding adapter (bead-0779)
- [ ] Chunking adapters (bead-0780)

### M3 — API + Cockpit (bead-0766)

- [ ] OpenAPI spec for retrieval endpoints
- [ ] Cockpit search UI (semantic + graph)

---

## 6. Decision gates

| Gate | Question                                                       | Pass criteria                                              |
| ---- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| M0   | Are all deps license-compatible?                               | `npm run license:check` exits 0                            |
| M1   | Is projection idempotent?                                      | Re-projection of same run produces identical artefacts     |
| M2   | Does Weaviate adapter pass `SemanticIndexPort` contract tests? | MIS v0.1 adapter test suite green                          |
| M3   | Can the Cockpit return semantically relevant runs for a query? | Manual QA: top-3 results are relevant for 3/3 test queries |

---

## 7. Related documents

| Document                                         | Purpose                                 |
| ------------------------------------------------ | --------------------------------------- |
| `src/sdk/mis-v1.ts`                              | MIS adapter interface                   |
| `docs/how-to/vv-campaign.md`                     | V&V campaign overview                   |
| `docs/how-to/licensing-gate.md`                  | License compliance                      |
| `docs/adr/ADR-0080-credential-boundary-model.md` | Credential isolation for embedding APIs |
