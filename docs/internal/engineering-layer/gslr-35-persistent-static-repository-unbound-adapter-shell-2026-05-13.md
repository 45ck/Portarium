# GSLR-35 Persistent Static Repository Unbound Adapter Shell: 2026-05-13

Status: implemented as docs/test-only domain shell evidence
Tracking bead: `bead-1282`

## Decision

`bead-1282` adds an unbound PostgreSQL adapter shell contract for the
persistent static repository.

This contract makes the adapter shell shape concrete enough to review while
keeping it non-operational. It does not authorize a database client, connection
configuration, generated SQL files, secrets, applied migrations, production
tables, reads, or writes.

## Gate

The shell is gated by GSLR-34:

```text
GSLR-34 scaffold code-review evidence
  -> ready-to-open-unbound-adapter-shell-bead
  -> GSLR-35 unbound adapter shell contract
```

If the scaffold code review is blocked, this shell contract blocks and carries
the review blockers forward.

## What Was Built

The new shell contract is:

```text
portarium.gslr-persistent-static-repository-unbound-adapter-shell.v1
```

The code lives at:

```text
src/domain/evidence/gslr-persistent-static-repository-unbound-adapter-shell-v1.ts
src/domain/evidence/gslr-persistent-static-repository-unbound-adapter-shell-v1.test.ts
```

The contract fixes:

- adapter name `GslrPersistentStaticRepositoryPostgresAdapter`;
- implementation mode `unbound-shell-only`;
- exported persistent static repository port methods;
- constructor boundary with no database client binding;
- transaction boundary declared but not bound;
- method bodies that throw not-implemented rather than execute database work;
- declared-only error mapping;
- visible review surface for port shape, constructor boundary, transaction
  boundary, database-binding TODO, and contract-harness TODO.

## What It Proves

GSLR-35 proves we can make the adapter shell more concrete without crossing into
database implementation.

This matters because the next risky transition is subtle: a shell can become a
real adapter if a constructor accepts a database client, method bodies execute
SQL, connection config appears, generated SQL files appear, migrations are
applied, or read/write execution becomes enabled. This contract blocks that
drift explicitly.

## What Blocks

The shell blocks when any of these appear:

- GSLR-34 review not ready;
- wrong adapter name;
- implementation mode not `unbound-shell-only`;
- missing required port methods;
- constructor bound to a database client;
- transaction boundary bound;
- method bodies executing database work;
- executable error mapping;
- database client binding;
- connection configuration;
- generated SQL files;
- secret references;
- applied migrations;
- production tables;
- read or write execution;
- hidden port shape, constructor boundary, transaction boundary, database TODO,
  or contract harness TODO;
- live prompt-language polling;
- queues;
- SSE streams;
- runtime cards;
- production actions;
- MC connector access.

## What Remains Blocked

Still blocked:

- database client binding;
- connection configuration;
- generated SQL files;
- secret references;
- applying database migrations;
- creating production imported-record tables;
- enabling database reads or writes;
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
npm run test -- src/domain/evidence/gslr-persistent-static-repository-unbound-adapter-shell-v1.test.ts src/domain/evidence/gslr-persistent-static-repository-scaffold-code-review-v1.test.ts src/domain/evidence/gslr-persistent-static-repository-executable-adapter-scaffold-v1.test.ts
```

The focused tests prove:

- a ready GSLR-34 review can open unbound shell review;
- blocked GSLR-34 review state carries forward as shell blockers;
- database-bound shell drift blocks;
- forbidden database artifacts and read/write execution block;
- hidden review surfaces and runtime authority block.

## Next Step

Open `bead-1283` for unbound adapter shell review. That review should verify the
shell remains non-operational before any database client binding, connection
config, generated SQL, secrets, applied migrations, production tables,
read/write execution, runtime cards, production actions, or MC connector access.

The unbound adapter shell review is recorded in
[`gslr-36-persistent-static-repository-unbound-adapter-shell-review-2026-05-13.md`](./gslr-36-persistent-static-repository-unbound-adapter-shell-review-2026-05-13.md).
