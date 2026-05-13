# GSLR-31 Persistent Static Repository Draft SQL Review: 2026-05-13

Status: implemented as docs/test-only domain review packet
Tracking bead: `bead-1278`

## Decision

`bead-1278` adds a draft SQL review packet over the GSLR-30 PostgreSQL adapter
scaffold.

This is still not executable PostgreSQL adapter code. It is the review packet
that decides whether the scaffold is clean enough to open a later executable
adapter design-review bead.

## Gate

The packet is gated by GSLR-30:

```text
GSLR-30 draft PostgreSQL adapter scaffold
  -> ready-for-draft-adapter-code-review
  -> GSLR-31 draft SQL review packet
```

If the scaffold is blocked, the SQL review packet blocks and carries the
scaffold blockers forward.

## What Was Built

The new review contract is:

```text
portarium.gslr-persistent-static-repository-draft-sql-review.v1
```

The code lives at:

```text
src/domain/evidence/gslr-persistent-static-repository-draft-sql-review-v1.ts
src/domain/evidence/gslr-persistent-static-repository-draft-sql-review-v1.test.ts
```

The packet reviews:

- draft PostgreSQL table mapping;
- draft PostgreSQL statement plan;
- idempotency, record ID, fingerprint, raw payload, and review-state
  constraints;
- draft-drop-only rollback posture;
- GSLR-27 adapter contract assertion coverage plan;
- no-runtime authority guard list.

## What It Proves

GSLR-31 proves the SQL layer can be reviewed separately from executable adapter
implementation.

That matters because the risky jump is not "can we describe the tables"; it is
"did we silently create a database connection, migration path, or write path
while describing the tables." This packet keeps those separate:

- table mapping must be reviewed;
- statement plan must be reviewed;
- constraints must be reviewed;
- rollback posture must be reviewed;
- contract assertion coverage must be reviewed;
- executable adapter code must not be included;
- production DDL, production DML, connection config, and raw payload columns
  must remain absent.

## What Blocks

The packet blocks when any of these appear:

- scaffold not ready;
- unreviewed table mapping;
- unreviewed statement plan;
- unreviewed constraint set;
- unreviewed rollback posture;
- unreviewed contract assertion coverage;
- executable adapter code included;
- executable SQL;
- non-parameterized statements;
- raw payload column;
- production DDL;
- production DML;
- connection configuration;
- engineering, security, or data review change request;
- live prompt-language polling;
- queues;
- SSE streams;
- runtime cards;
- production actions;
- MC connector access.

## What Remains Blocked

Still blocked:

- executable PostgreSQL adapter code;
- creating a database connection;
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
npm run test -- src/domain/evidence/gslr-persistent-static-repository-draft-sql-review-v1.test.ts src/domain/evidence/gslr-persistent-static-repository-draft-postgres-adapter-v1.test.ts src/domain/evidence/gslr-persistent-static-repository-database-adapter-review-v1.test.ts
```

The focused tests prove:

- a ready scaffold can produce a ready SQL review packet;
- blocked scaffold state carries forward as review blockers;
- incomplete review scope blocks;
- executable adapter code blocks;
- unsafe SQL posture and connection configuration block;
- reviewer change requests and runtime authority surfaces block.

## Next Step

Open `bead-1279` for an executable adapter design-review contract. That bead
should still be design-only: no database connection config, no applied
migrations, no production tables, no production writes, no runtime cards, no
production actions, and no MC connector access.

The executable adapter design review is recorded in
[`gslr-32-persistent-static-repository-executable-adapter-design-review-2026-05-13.md`](./gslr-32-persistent-static-repository-executable-adapter-design-review-2026-05-13.md).
