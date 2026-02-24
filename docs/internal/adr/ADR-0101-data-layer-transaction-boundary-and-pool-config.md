# ADR-0101 — Data Layer: Explicit Transaction Boundary and Pool Configuration

**Status:** Accepted
**Date:** 2026-02-23
**Bead:** bead-6i3j (research integration bead-tx1 + bead-pool1 validation)

## Context

The data-layer research report (report-21.md, bead-abk6 triage) identified two
high-risk operational gaps:

1. **No explicit transaction boundary** — `SqlClient` exposed only `query()`.
   Multi-step operations (write aggregate + insert outbox event) were not
   wrapped in a single database transaction, risking partial writes if a step
   failed mid-flight.

2. **Pool configuration relies on pg defaults** — `NodePostgresSqlClient` was
   constructed with only a connection string. Pool size (`max`), idle timeout,
   and connection timeout were left at library defaults, which are not tuned for
   production and cannot be overridden via environment variables without code
   changes.

These were addressed by bead-tx1 and bead-pool1 respectively. This ADR
documents the decisions made.

## Decision

### 1. `withTransaction<T>` on `SqlClient`

The `SqlClient` interface (formerly having only `query`) now includes:

```typescript
withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T>;
```

`NodePostgresSqlClient.withTransaction` acquires a `pg.PoolClient`, issues
`BEGIN`, calls `fn(txClient)` where `txClient` wraps the client's `query`,
then issues `COMMIT` on success or `ROLLBACK` on error before releasing the
client back to the pool.

Application use-cases that perform multi-write operations (e.g.,
`writeAggregate` + `insertOutboxEvent`) MUST use `withTransaction` to guarantee
atomicity. Violation of this rule is a data-correctness bug.

### 2. Explicit `NodePostgresPoolConfig`

`NodePostgresSqlClient` now accepts a `NodePostgresPoolConfig` object:

```typescript
interface NodePostgresPoolConfig {
  connectionString: string;
  maxConnections?: number; // default: 10
  idleTimeoutMs?: number; // default: 10_000
  connectionTimeoutMs?: number; // default: 5_000
}
```

Defaults are intentional (not pg library defaults which differ) and surface via
the following environment variables resolved at startup:

- `PORTARIUM_DB_POOL_MAX` — pool size (integer)
- `PORTARIUM_DB_POOL_IDLE_TIMEOUT_MS` — idle timeout (ms)
- `PORTARIUM_DB_CONNECTION_TIMEOUT_MS` — connection timeout (ms)

This makes pool tuning possible without code changes in any deployment
environment.

## Consequences

### Positive

- **Transactional Outbox** — aggregate writes and outbox row inserts are now
  atomic. No partial write state is observable from concurrent transactions.
- **Explicit failure modes** — connection timeout / pool exhaustion surfaces
  as a configurable boundary, not a silent pg default.
- **Testable** — `withTransaction` can be stubbed in unit tests via
  `InMemorySqlClient` which delegates to a synchronous callback (no rollback
  semantics needed for in-memory tests).

### Negative / Trade-offs

- **Test isolation** — nested `withTransaction` calls in integration tests
  require care. The implementation does not support savepoints (nested
  transactions). If a use-case calls `withTransaction` inside another, the
  inner call will acquire a separate connection — not a nested transaction.
  This is an acceptable limitation for the current scale; savepoints can be
  added if needed.
- **Pool exhaustion** — long-running transactions hold a connection for their
  duration. Callers must not hold transactions open across I/O-heavy or
  human-facing waits.

## Compliance Mapping

| Requirement                                     | Addressed by                        |
| ----------------------------------------------- | ----------------------------------- |
| Transactional Outbox (report-21 §3)             | `withTransaction` in bead-tx1       |
| Pool sizing (report-21 §6)                      | `NodePostgresPoolConfig` bead-pool1 |
| OWASP A04 (Insecure Design) — no partial writes | `withTransaction`                   |

## References

- report-21.md — "No unit-of-work / transaction boundary" + "Pool config relies on defaults"
- bead-tx1 — implementation PR
- bead-pool1 — implementation PR
- ADR-0096 — CI Postgres migration apply (companion data-layer ADR)
- PostgreSQL docs — `BEGIN / COMMIT / ROLLBACK`, `pg_pool` connection lifecycle
