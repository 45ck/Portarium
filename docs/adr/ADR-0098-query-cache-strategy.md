# ADR-0098: Query Cache Strategy — Cache-Aside with TTL for Hot Policy/Config Reads

**Status**: Accepted
**Date**: 2026-02-23
**Bead**: bead-mvuv

## Context

Every inbound request to the control plane evaluates an OpenFGA policy check and loads
workspace configuration from Postgres. Under production load this creates two sequential
database round-trips on the hot path. Benchmarks from report-31 (bead-ev20 / bead-lh3q)
identified these as the primary latency bottleneck.

## Decision

Implement a **cache-aside** pattern via a `QueryCache` port (see
`src/application/ports/query-cache.ts`) with two adapters:

| Adapter | Class | Environment |
|---|---|---|
| In-process LRU + TTL | `InMemoryQueryCache` | local-dev, test |
| Redis strings with EX TTL | `RedisQueryCache` | staging, production |

Selected adapter is controlled by `QUERY_CACHE_STORE=redis|memory` at bootstrap.

### TTL choices

| Cache key scope | TTL | Rationale |
|---|---|---|
| Workspace list (`workspaces:*`) | 30 s | Config changes are low-frequency; 30 s lag is acceptable |
| Run list per workspace | 10 s | Run status changes more often; shorter lag for fresher data |
| OpenFGA policy check result | 5 s | Permissions can be revoked; short TTL limits the exposure window |

### Invalidation

- **Prefix invalidation** (`invalidatePrefix(prefix)`) sweeps all keys matching a prefix.
  In-memory implementation uses Map iteration; Redis uses `SCAN + DEL`.
- Mutations to workspace config must call `cache.invalidatePrefix(tenantId)` to evict
  stale workspace entries. This is enforced at the route handler level (write routes call
  invalidation before returning 2xx).

### Fail-open policy

`RedisQueryCache` wraps all calls in `try/catch`. On Redis unavailability:
- `get()` returns `null` (cache miss — falls through to Postgres)
- `set()` is silently dropped
- `invalidate()` / `invalidatePrefix()` are silently dropped

This prevents a Redis outage from blocking traffic. A Redis outage degrades to
uncached Postgres reads, not an outage.

### OTel metrics

Cache hit/miss counters are emitted as `cache.hits` and `cache.misses` on the OTel
metrics pipeline via the Prometheus registry (implementation deferred to bead-0315).

## Consequences

**Positive**:
- Hot reads served from cache on repeat calls within the TTL window
- Zero application-layer dependency on Redis availability (fail-open)
- Dev/test environments use in-process cache with no external services
- Consistent key schema via `queryCacheKey()` helper

**Negative/Risks**:
- Up to TTL seconds of staleness on reads after a write (acceptable per design)
- In-memory cache is not shared across multiple workers/pods (fine for stateless
  horizontal scaling since each pod has its own warm cache)
- Redis `SCAN`-based prefix invalidation is O(total keys) and can be slow under
  high key counts — mitigated by using short TTLs and prefixed key layout
