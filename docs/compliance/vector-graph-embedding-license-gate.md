# Licensing/Compliance Gate: Vector, Graph, and Embedding Dependencies

> **Audience**: Release manager, legal counsel (if available), senior maintainer.
>
> **Goal**: Verify that all vector-database, graph-database, and embedding-model
> dependencies in the Derived Artifacts campaign are license-compatible with the
> Portarium core license before any code using them ships.

---

## 1. Dependency inventory

### 1.1 Vector database clients

| Package | License | Verdict | Notes |
|---------|---------|---------|-------|
| `weaviate-client` | BSD-3-Clause | ✅ | Weaviate server is BSL 1.1 (server-side, not distributed) |
| `@pinecone-database/pinecone` | Apache-2.0 | ✅ | Client only; Pinecone server is proprietary SaaS |
| `@qdrant/js-client-rest` | Apache-2.0 | ✅ | |
| `pgvector` (PostgreSQL extension) | PostgreSQL License | ✅ | Permissive, BSD-like |
| `pg` (PostgreSQL client) | MIT | ✅ | |

### 1.2 Graph database clients

| Package | License | Verdict | Notes |
|---------|---------|---------|-------|
| `neo4j-driver` | Apache-2.0 | ✅ | Neo4j Community is GPL; driver is Apache |
| `@neo4j/graphql` | Apache-2.0 | ✅ | |
| `graphology` | MIT | ✅ | In-process graph library |
| `graphology-layout` | MIT | ✅ | |

> **Neo4j server note**: Neo4j Community Edition is GPL-licensed. Do NOT bundle or
> redistribute the Neo4j server binary. Use it as a standalone external service only.
> Neo4j Enterprise requires a commercial license.

### 1.3 Embedding model clients and runtimes

| Package | License | Verdict | Notes |
|---------|---------|---------|-------|
| `openai` | MIT | ✅ | Client; OpenAI API is proprietary (pay per use) |
| `@anthropic-ai/sdk` | MIT | ✅ | Client |
| `onnxruntime-node` | MIT | ✅ | ONNX Runtime; supports local model inference |
| `@xenova/transformers` | Apache-2.0 | ✅ | Hugging Face Transformers.js — local inference |
| `@huggingface/inference` | Apache-2.0 | ✅ | HF Inference API client |

### 1.4 Embedding models (if bundled)

| Model | License | Verdict | Notes |
|-------|---------|---------|-------|
| `sentence-transformers/all-MiniLM-L6-v2` | Apache-2.0 | ✅ | Local inference |
| `BAAI/bge-small-en-v1.5` | MIT | ✅ | Local inference |
| OpenAI `text-embedding-3-small` | Proprietary | ✅ (API) | Not bundled; API only |

> **Do NOT bundle proprietary model weights**. Use API endpoints or Apache/MIT-licensed
> ONNX models only.

---

## 2. Server-side dependency notes

The following servers are used as external services (not bundled or redistributed):

| Server | License | Distribution model |
|--------|---------|-------------------|
| Weaviate | BSL 1.1 (converts to Apache-2.0 after 4 years) | Docker image, self-hosted |
| Neo4j Community | GPL-3.0 | Docker image, self-hosted |
| PostgreSQL + pgvector | PostgreSQL License | Managed service |

**Compliance**: Since these are external services (not compiled into Portarium), they
do not trigger GPL/BSL obligations for the Portarium binary distribution.

---

## 3. License gate CI command

```bash
# Add to ci:nightly (not ci:pr — dev deps like onnxruntime may have unusual licenses)
npx license-checker --production \
  --onlyAllow "MIT;ISC;BSD-2-Clause;BSD-3-Clause;Apache-2.0;PostgreSQL;Python-2.0;CC0-1.0;Unlicense;0BSD" \
  --excludePrivatePackages \
  --out docs/compliance/vector-graph-license-report.csv
```

---

## 4. Pre-implementation checklist

Before implementing any code that imports the packages in section 1:

- [ ] All packages in section 1 reviewed and verdict recorded above
- [ ] Neo4j server deployment documented as "external service only" in deployment runbook
- [ ] No model weights with proprietary licenses are bundled in the npm package
- [ ] `NOTICE.md` updated with Apache-2.0 attributions (weaviate-client, openai, neo4j-driver, etc.)
- [ ] `docs/compliance/vector-graph-license-report.csv` generated and committed
- [ ] Release manager sign-off

---

## 5. Related documents

| Document | Purpose |
|----------|---------|
| `docs/how-to/licensing-gate.md` | General licensing gate checklist |
| `docs/how-to/derived-artifacts-retrieval-campaign.md` | Campaign overview |
| `docs/how-to/supply-chain-guardrails.md` | Supply-chain controls |
