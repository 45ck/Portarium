# GSLR-30 Persistent Static Repository Draft PostgreSQL Adapter: 2026-05-13

Status: implemented as docs/test-only domain scaffold
Tracking bead: `bead-1277`

## Decision

`bead-1277` adds the first draft PostgreSQL adapter scaffold for the persistent
static repository.

This is not an executable database adapter. It is a review-gated scaffold and
non-executable SQL plan that can be reviewed before any connection string,
migration application, production table creation, or production write path
exists.

## Gate

The scaffold is gated by GSLR-29:

```text
GSLR-29 database-adapter review checkpoint
  -> ready-to-open-draft-postgres-adapter-bead
  -> GSLR-30 draft PostgreSQL adapter scaffold
```

If the review checkpoint is paused, declined, blocked, or still has review
needs, the draft scaffold blocks.

## What Was Built

The new scaffold contract is:

```text
portarium.gslr-persistent-static-repository-draft-postgres-adapter.v1
```

The code lives at:

```text
src/domain/evidence/gslr-persistent-static-repository-draft-postgres-adapter-v1.ts
src/domain/evidence/gslr-persistent-static-repository-draft-postgres-adapter-v1.test.ts
```

The scaffold records:

- adapter kind `draft-postgres-adapter`;
- implementation mode `contract-scaffold-only`;
- absent connection configuration;
- migration status `draft-not-applied`;
- production tables not created;
- production writes disabled;
- non-executable parameterized SQL statement plan;
- imported-record and audit-event table mapping;
- idempotency, record ID, fingerprint, raw payload, and review-state
  constraints;
- GSLR-27 adapter contract assertion plan;
- no-runtime authority guard list.

## What It Proves

GSLR-30 proves Portarium can move one step closer to database implementation
without accidentally creating runtime authority.

The draft adapter scaffold is useful because it makes the next engineering
review concrete:

- the table mapping is visible;
- the SQL statement surface is listed;
- parameterization is required;
- raw payload columns are forbidden;
- rollback is draft-drop-only;
- every GSLR-27 adapter assertion has a planned database-backed check;
- executable adapter code remains blocked.

## What Blocks

The scaffold blocks when any of these appear:

- review checkpoint not ready;
- review checkpoint blockers, needs, or decline notes;
- production PostgreSQL adapter kind;
- executable adapter mode;
- present connection configuration;
- applied migration;
- created production tables;
- enabled production writes;
- executable SQL plan;
- non-parameterized statements;
- missing imported-record or audit-event table mapping;
- raw payload column;
- missing constraints;
- missing rollback plan;
- missing statement plan;
- missing contract assertion plan;
- live prompt-language polling;
- queues;
- SSE streams;
- runtime cards;
- production actions;
- MC connector access.

## What Remains Blocked

Still blocked:

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
npm run test -- src/domain/evidence/gslr-persistent-static-repository-draft-postgres-adapter-v1.test.ts src/domain/evidence/gslr-persistent-static-repository-database-adapter-review-v1.test.ts src/domain/evidence/gslr-persistent-static-repository-contract-harness-adapter-v1.test.ts
```

The focused tests prove:

- a ready review checkpoint can produce a ready draft scaffold;
- a paused review checkpoint blocks the scaffold;
- production-shaped adapter state blocks;
- executable SQL, raw payload columns, missing constraints, and missing
  statements block;
- missing contract assertions and runtime authority surfaces block.

## Next Step

Open `bead-1278` for a draft SQL review packet. That packet should inspect the
table mapping, statement plan, constraint set, rollback posture, and GSLR-27
contract-assertion coverage before any executable PostgreSQL adapter code is
written.

Do not add a database connection, apply migrations, create production tables, or
enable production writes in the next bead.
