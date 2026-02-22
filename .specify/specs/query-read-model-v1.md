# Query Read-Model Projection Strategy — v1

**Bead:** bead-0315
**Status:** Active
**ADR reference:** ADR-0049 (multi-tenant storage tiers), ADR-0070 (hybrid orchestration/choreography boundary)

## Overview

This spec defines the read-model projection and caching strategy for the Portarium application
query layer. The goal is to decouple read paths from authoritative write stores, enabling
scalable, fast query responses via:

1. Denormalized read tables (projection tables) that are updated by event-driven projectors
2. A cache-aside pattern layered in front of query handlers for short-lived response caching
3. Event-driven cache invalidation triggered when domain state changes

---

## Architecture

### Projection Tables

Two projection tables serve as denormalized read models:

| Table               | Primary Key                 | Scope  |
| ------------------- | --------------------------- | ------ |
| `workflow_runs`     | `(tenant_id, run_id)`       | Tenant |
| `workspace_summary` | `(tenant_id, workspace_id)` | Global |

These tables are populated by the `ReadModelProjector` port and its PostgreSQL implementation
(`PostgresReadModelProjector`). All upserts are idempotent via an `event_seq` guard:

```sql
ON CONFLICT (...) DO UPDATE SET ... WHERE EXCLUDED.event_seq > table.event_seq
```

This makes projectors safe to replay in the event of reprocessing or at-least-once delivery.

### Cache-Aside Pattern

Query handlers (`listRuns`, `listWorkspaces`) accept an optional `QueryCache` dependency.

**On read:**

1. Build a tenant-scoped cache key using `queryCacheKey(tenantId, handler, ...parts)`
2. Check cache — if hit, return immediately
3. On miss, execute the authoritative store query
4. Store result in cache with 30 second TTL
5. Return result

**TTL policy:** 30 seconds for list queries. This balances staleness tolerance against infrastructure
cost. Adjust per deployment requirements.

**Fallback behaviour:** If `queryCache` is `null` or omitted, the handler falls back to an
authoritative read with no caching. This ensures backwards compatibility and makes testing
straightforward.

### Cache Key Format

```
{tenantId}:{handler}:{...discriminating parts joined by ':'}
```

Examples:

- `tenant-1:listRuns:ws-1:undefined::10`
- `tenant-1:listWorkspaces:Demo::20`

### Cache Invalidation

The `CacheInvalidationService` invalidates by prefix after mutations:

| Event                     | Invalidated prefixes                                     |
| ------------------------- | -------------------------------------------------------- |
| Run created/updated       | `{tenantId}:listRuns:`, `{tenantId}:getRun:`             |
| Workspace created/updated | `{tenantId}:listWorkspaces:`, `{tenantId}:getWorkspace:` |

Call `CacheInvalidationService.onRunChanged()` / `onWorkspaceChanged()` from command handlers
or event subscribers after state changes are committed.

---

## Migrations

| Version | ID                                             | Description                                                                                                          |
| ------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 6       | `0006_expand_workflow_runs_projection_columns` | Adds `workspace_id`, `workflow_id`, `initiated_by_user_id`, `started_at`, `ended_at`, `event_seq` to `workflow_runs` |
| 7       | `0007_expand_workspace_summary_table`          | Creates `workspace_summary` projection table                                                                         |

---

## Implementation Files

| File                                                             | Purpose                                         |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| `src/application/ports/query-cache.ts`                           | `QueryCache` interface + `queryCacheKey` helper |
| `src/application/ports/read-model-projector.ts`                  | `ReadModelProjector` port + event types         |
| `src/infrastructure/caching/in-memory-query-cache.ts`            | Local/test `QueryCache` implementation          |
| `src/infrastructure/postgresql/postgres-read-model-projector.ts` | Production projector                            |
| `src/application/services/cache-invalidation-service.ts`         | Domain event → cache invalidation               |
| `src/application/queries/list-runs.ts`                           | Updated with optional `queryCache`              |
| `src/application/queries/list-workspaces.ts`                     | Updated with optional `queryCache`              |

---

## Testing Requirements

- `in-memory-query-cache.test.ts`: TTL expiry, `invalidate`, `invalidatePrefix`, overwrite
- `list-runs-with-cache.test.ts`: Cache hit on second call, null cache fallback, key format, TTL miss
- `postgres-read-model-projector.test.ts`: Correct SQL for upsert, null params, event_seq guard

---

## Non-goals

- Redis/distributed cache implementation (future work — swap `InMemoryQueryCache` for `RedisQueryCache`)
- Automatic projection from domain events (requires event subscriber wiring, out of scope)
- Read-your-writes consistency (not guaranteed; use authoritative reads for post-write confirmations)
