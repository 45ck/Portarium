# GSLR-32 Persistent Static Repository Executable Adapter Design Review: 2026-05-13

Status: implemented as docs/test-only domain review contract
Tracking bead: `bead-1279`

## Decision

`bead-1279` adds an executable adapter design-review contract for the persistent
static repository PostgreSQL path.

This is still design-only. It does not add executable adapter code, connection
configuration, generated SQL files, applied migrations, production tables, or
production writes.

## Gate

The design review is gated by GSLR-31:

```text
GSLR-31 draft SQL review packet
  -> ready-for-executable-adapter-design-review
  -> GSLR-32 executable adapter design review
```

If the SQL review packet is blocked, this design review blocks and carries the
SQL review blockers forward.

## What Was Built

The new design-review contract is:

```text
portarium.gslr-persistent-static-repository-executable-adapter-design-review.v1
```

The code lives at:

```text
src/domain/evidence/gslr-persistent-static-repository-executable-adapter-design-review-v1.ts
src/domain/evidence/gslr-persistent-static-repository-executable-adapter-design-review-v1.test.ts
```

The review covers:

- persistent static repository adapter interface mapping;
- transaction boundary design for append and review-transition operations;
- idempotent replay and conflict error mapping design;
- GSLR-27 contract harness binding plan;
- static-only observability plan;
- no-runtime authority guard list.

## What It Proves

GSLR-32 proves executable adapter work can be prepared without yet becoming
executable.

The design review is allowed to say how an executable adapter should be shaped,
but it blocks anything that would turn that design into database behavior:

- implementation mode must remain `design-review-only`;
- executable adapter code must be absent;
- connection config must be absent;
- generated SQL files must be absent;
- secret references must be absent;
- migrations must remain draft-not-applied;
- production tables and writes must remain disabled.

## What Blocks

The review blocks when any of these appear:

- SQL review packet not ready;
- missing adapter interface mapping;
- missing transaction boundary mapping;
- missing idempotent replay mapping;
- missing conflict error mapping review;
- missing contract harness binding review;
- missing observability plan review;
- executable adapter code included;
- implementation mode changed to executable;
- connection configuration;
- applied migration;
- created production tables;
- enabled production writes;
- generated SQL files;
- secret references;
- engineering, security, data, or operations change request;
- live prompt-language polling;
- queues;
- SSE streams;
- runtime cards;
- production actions;
- MC connector access.

## What Remains Blocked

Still blocked:

- executable PostgreSQL adapter implementation;
- connection configuration;
- generated SQL files;
- secret references;
- applying database migrations;
- creating production imported-record tables;
- enabling production writes;
- production keyring implementation;
- live artifact fetching;
- artifact byte storage implementation;
- live prompt-language manifest polling;
- route-record queues;
- SSE streams for GSLR evidence;
- runtime Cockpit engineering cards;
- automatic route decisions;
- production actions;
- MC connector observation;
- source-system reads/writes;
- raw school-data movement.

## Validation

Focused validation:

```sh
npm run test -- src/domain/evidence/gslr-persistent-static-repository-executable-adapter-design-review-v1.test.ts src/domain/evidence/gslr-persistent-static-repository-draft-sql-review-v1.test.ts src/domain/evidence/gslr-persistent-static-repository-draft-postgres-adapter-v1.test.ts
```

The focused tests prove:

- a ready SQL review packet can open an executable adapter scaffold bead;
- blocked SQL review state carries forward as design-review blockers;
- incomplete design scope blocks;
- executable adapter code blocks;
- connection config, applied migration, production tables/writes, generated SQL
  files, and secret references block;
- reviewer change requests and runtime authority surfaces block.

## Next Step

Open `bead-1280` for an executable adapter scaffold. That scaffold must still
omit connection configuration, applied migrations, production tables, production
writes, runtime cards, production actions, and MC connector access.

The executable adapter scaffold is recorded in
[`gslr-33-persistent-static-repository-executable-adapter-scaffold-2026-05-13.md`](./gslr-33-persistent-static-repository-executable-adapter-scaffold-2026-05-13.md).
