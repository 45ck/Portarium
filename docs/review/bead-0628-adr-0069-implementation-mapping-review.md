# Review: bead-0628 (ADR-0069 Implementation Mapping Closure)

Reviewed on: 2026-02-20

Scope:

- `docs/adr/0069-postgresql-store-adapter-contract.md`
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

## Findings

High:

- none.

Medium:

- none.

Low:

- none.

## Acceptance Evidence

ADR implementation linkage added:

- Added explicit ADR-0069 mapping to closed implementation/review coverage:
  - `bead-0335`
  - `bead-0316`
  - `bead-0391`
  - `bead-0385`
  - `bead-0484`
  - `bead-0486`
  - `bead-0597`

Evidence pointers added in ADR:

- PostgreSQL store adapters and SQL client boundaries are implemented under infrastructure ports.
- Outbox/event persistence and migration contracts are covered with integration and migration tests.
- Runtime wiring supports opt-in PostgreSQL adapter activation behind environment toggles.

Remaining-gap traceability:

- Added explicit linkage to existing open gap `bead-0392` for multi-tenant storage tier automation.
