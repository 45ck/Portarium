# ADR-0069: PostgreSQL Store Adapter Contract

## Status

Accepted

## Context

Application commands and queries depend on store, outbox, event publisher, and ID-generation ports. Prior runtime wiring used in-memory placeholders, which blocked infrastructure integration work and prevented adapter-level integration testing.

## Decision

Introduce infrastructure adapters under `src/infrastructure/postgresql/` with a shared SQL client contract.

- `SqlClient` defines the minimal query interface used by repositories.
- PostgreSQL store adapters implement application ports for:
  - workspace/run/workflow/adapter-registration/approval/policy/idempotency,
  - work-item/workforce member/human task/workforce queue,
  - evidence log append chaining,
  - outbox persistence and publisher bridge,
  - ID generation via cryptographic UUID.
- Runtime dependency wiring supports PostgreSQL-backed workspace/run stores when:
  - `PORTARIUM_USE_POSTGRES_STORES=true`
  - `PORTARIUM_DATABASE_URL` is configured
- Default runtime behavior remains in-memory fallback when PostgreSQL wiring is disabled.

## Consequences

- Infrastructure adapters are now concrete and testable behind the application-port boundary.
- Deployments can opt into PostgreSQL stores without changing application-layer code.
- Outbox and evidence persistence have infrastructure implementations ready for broader command wiring.
- A full production schema rollout still depends on migration execution and deploy-time table management.

## Implementation Mapping

The PostgreSQL adapter contract in this ADR is implemented and verified by:

- `bead-0335`: PostgreSQL infra adapter baseline and store adapter contract implementation.
- `bead-0316`: outbox ordering and replay safety coverage across application/infra boundaries.
- `bead-0391`: migration framework required for contract-safe schema evolution.
- `bead-0385`: infrastructure test hardening and adapter behavior verification.
- `bead-0484`: infrastructure adapter wiring validation review.
- `bead-0486`: outbox event dispatcher review and evidence linkage.
- `bead-0597`: adapter activation/wiring completion for PostgreSQL-backed runtime behavior.

## Acceptance Evidence

- `src/infrastructure/postgresql/sql-client.ts`
- `src/infrastructure/postgresql/node-postgres-sql-client.ts`
- `src/infrastructure/postgresql/postgres-json-document-store.ts`
- `src/infrastructure/postgresql/postgres-store-adapters.ts`
- `src/infrastructure/postgresql/postgres-workforce-store-adapters.ts`
- `src/infrastructure/postgresql/postgres-eventing.ts`
- `src/infrastructure/postgresql/postgres-store-adapters.integration.test.ts`
- `src/infrastructure/migrations/schema-migrator.ts`
- `src/infrastructure/migrations/schema-migrator.test.ts`
- `docs/review/bead-0484-infrastructure-adapters-wiring-review.md`
- `docs/review/bead-0486-outbox-event-dispatcher-review.md`

## Review Linkage

- `bead-0628`: implementation mapping closure review
- `docs/review/bead-0628-adr-0069-implementation-mapping-review.md`
- `bead-0629`: mapping/linkage verification review
- `docs/review/bead-0629-adr-0069-linkage-review.md`

## Remaining Gap Tracking

- `bead-0392`: multi-tenant storage tier automation follow-through (schema-per-tenant provisioning lifecycle).

## Alternatives Considered

- Keep runtime-level in-memory placeholders
  - Rejected: no persistence parity and no adapter integration evidence.
- Bind application layer directly to `pg`
  - Rejected: violates port-adapter layering and reduces testability.
