# ADR-0111: RAG Tenancy Isolation

- **Status**: Accepted
- **Date**: 2026-02-23
- **Bead**: bead-vuz4
- **Deciders**: Platform Security Team

## Context

Portarium uses Retrieval-Augmented Generation (RAG) with both vector (pgvector)
and graph (knowledge graph) backends. In a multi-tenant SaaS deployment, every
retrieval query must be scoped to the caller's workspace. A filter bypass in the
storage adapter would leak documents from one workspace into another's LLM
context -- a critical data leakage vector.

The existing `pgvector-semantic-index-adapter` already scopes queries by
`workspace_id`, but there is no domain-level enforcement model that:

1. Defines which isolation strategies are available and their trade-offs.
2. Validates that cross-workspace retrieval is only permitted under safe
   configurations.
3. Provides post-query defense to catch storage-layer filter bypass bugs.
4. Guards destructive workspace data lifecycle operations (purge, deprovision).

## Decision

Introduce a domain model (`rag-tenancy-isolation-v1`) that codifies RAG tenancy
isolation rules as pure validation functions with no infrastructure dependencies.

### Vector DB isolation strategies

| Strategy                     | Isolation | Operational cost | Risk                  |
| ---------------------------- | --------- | ---------------- | --------------------- |
| `collection-per-workspace`   | Strong    | Higher           | None (physical split) |
| `shared-collection-filtered` | Logical   | Lower            | Filter bypass = leak  |

### Graph DB isolation strategies

| Strategy                 | Isolation | Operational cost | Risk                      |
| ------------------------ | --------- | ---------------- | ------------------------- |
| `database-per-workspace` | Strong    | Higher           | None (physical split)     |
| `shared-graph-filtered`  | Logical   | Lower            | Traversal boundary escape |

### Policy rules

- **Cross-workspace retrieval** is only permitted with `collection-per-workspace`
  vector isolation, never with `shared-collection-filtered` (filter bypass risk
  is too high when queries intentionally cross boundaries).
- **Audit logging** is mandatory when cross-workspace retrieval is enabled.
- **maxResultsPerQuery** is capped at 1000 as defense-in-depth against
  exfiltration via oversized result sets.

### Post-query provenance validation

Every result returned by the storage adapter is checked against the query's
workspace scope. If a result belongs to a workspace other than the query's target
(and cross-workspace retrieval is disabled), it is flagged as a data leakage bug.
This is a defense-in-depth measure that catches storage adapter bugs at the
domain boundary.

### Workspace data lifecycle

Destructive actions (`purge`, `deprovision`) require a specific workspace ID --
wildcard patterns (`*`, `%`) are rejected to prevent accidental mass deletion.

## Consequences

- Storage adapters must pipe retrieval results through `validateResultProvenance`
  before returning to application layer.
- New vector/graph backends must declare which isolation strategy they implement.
- Cross-workspace search features require `collection-per-workspace` + audit
  logging, adding operational cost.
- Domain model has zero external dependencies and can be tested without
  infrastructure.
