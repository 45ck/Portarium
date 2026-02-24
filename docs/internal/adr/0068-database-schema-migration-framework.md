# ADR-0068: Database Schema Migration Framework

## Status

Accepted

## Context

Infrastructure delivery requires schema evolution before PostgreSQL-backed adapters are wired. The project needs a migration contract that is safe for multi-tenant rollout and aligns with rollback expectations in the infrastructure backlog.

Without a framework, schema changes risk:

- out-of-order upgrades,
- cross-tenant drift,
- irreversible contract cleanup,
- CI/deploy divergence.

## Decision

Adopt a versioned migration framework with explicit expand/contract phases.

1. Migration model

- Every migration has a strictly increasing integer `version` and stable `id`.
- Every migration declares:
  - `phase`: `Expand` or `Contract`,
  - `scope`: `Global` or `Tenant`,
  - `compatibility`: `BackwardCompatible` or `ContractBreaking`,
  - `upSql` and `downSql` statements.

2. Safety defaults

- CI and default deploy paths run **expand** migrations only.
- Contract-breaking migrations are blocked unless explicitly opted in.
- Contract migrations require rollback SQL.
- Contract migrations require prior expand history on the same migration target.

3. Tenant-aware execution

- Tenant-scoped migrations execute per tenant target.
- Migration journal records are stored per target (`global` or tenant ID).

4. Automation integration

- `npm run migrate:ci` validates registry invariants and executes expand dry-run.
- `npm run migrate:deploy` is invoked in deployment workflow before rollout.

## Consequences

- Backward-compatible rollout is enforced as the default posture.
- Rollback behavior is testable and deterministic in CI.
- Tenant migration history can diverge intentionally while remaining auditable.
- Contract cleanup becomes an explicit operational decision.

## Implementation Mapping

The migration framework in this ADR is implemented and verified by:

- `bead-0391`: core migration framework implementation (expand/contract model, compatibility policy, CLI/CI integration).

## Acceptance Evidence

- `src/infrastructure/migrations/schema-migrator.ts`
- `src/infrastructure/migrations/schema-migrator.test.ts`
- `src/infrastructure/migrations/default-migrations.ts`
- `src/infrastructure/migrations/cli.ts`
- `package.json` (`migrate:*` scripts)

## Review Linkage

- `bead-0626`: implementation mapping closure review
- `docs/internal/review/bead-0626-adr-0068-implementation-mapping-review.md`
- `bead-0627`: mapping/linkage verification review
- `docs/internal/review/bead-0627-adr-0068-linkage-review.md`

## Remaining Gap Tracking

- `bead-0392`: multi-tenant storage tier automation follow-through (schema-per-tenant provisioning lifecycle).

## Alternatives Considered

- **Single-phase migration system**
  - Rejected due weak safety around destructive changes.
- **Manual SQL execution outside repository**
  - Rejected due no CI enforcement and poor auditability.
- **Immediate use of ORM migration tooling**
  - Deferred until PostgreSQL adapter layer (bead-0335) chooses a persistence stack.
