# GSLR-36 Persistent Static Repository Unbound Adapter Shell Review: 2026-05-13

Status: implemented as docs/test-only domain review evidence
Tracking bead: `bead-1283`

## Decision

`bead-1283` adds an unbound adapter shell review contract for the persistent
static repository PostgreSQL adapter shell.

This review verifies the GSLR-35 shell remains non-operational before opening a
database-binding design-review bead. It does not authorize a database client,
connection configuration, generated SQL files, secrets, applied migrations,
production tables, reads, or writes.

## Gate

The review is gated by GSLR-35:

```text
GSLR-35 unbound adapter shell contract
  -> ready-for-unbound-adapter-shell-review
  -> GSLR-36 unbound adapter shell review
```

If the unbound shell is blocked, this review blocks and carries the shell
blockers forward.

## What Was Built

The new review contract is:

```text
portarium.gslr-persistent-static-repository-unbound-adapter-shell-review.v1
```

The code lives at:

```text
src/domain/evidence/gslr-persistent-static-repository-unbound-adapter-shell-review-v1.ts
src/domain/evidence/gslr-persistent-static-repository-unbound-adapter-shell-review-v1.test.ts
```

The review verifies:

- port methods reviewed;
- constructor boundary reviewed;
- transaction boundary reviewed;
- not-implemented method bodies reviewed;
- declared-only error mapping surface reviewed;
- database-binding TODO reviewed;
- contract-harness TODO reviewed;
- database client binding absent;
- connection config absent;
- generated SQL files absent;
- secret references absent;
- applied migrations absent;
- production tables absent;
- reads and writes blocked;
- engineering, security, and operations approve only database-binding design
  review as the next step.

## What It Proves

GSLR-36 proves the project can review a concrete adapter shell without treating
that review as permission to implement persistence.

This matters because the next valid step is design review for database binding,
not database binding itself. The review can approve the next design gate while
still blocking client injection, configuration, SQL generation, secrets,
migrations, tables, reads, writes, runtime cards, actions, and MC connector
access.

## What Blocks

The review blocks when any of these appear:

- GSLR-35 shell not ready;
- unreviewed port methods;
- unreviewed constructor boundary;
- unreviewed transaction boundary;
- unreviewed not-implemented method bodies;
- unreviewed error mapping surface;
- unreviewed database-binding TODO;
- unreviewed contract-harness TODO;
- database client binding;
- connection configuration;
- generated SQL files;
- secret references;
- applied migrations;
- production tables;
- read or write execution;
- engineering, security, or operations change request;
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
npm run test -- src/domain/evidence/gslr-persistent-static-repository-unbound-adapter-shell-review-v1.test.ts src/domain/evidence/gslr-persistent-static-repository-unbound-adapter-shell-v1.test.ts src/domain/evidence/gslr-persistent-static-repository-scaffold-code-review-v1.test.ts
```

The focused tests prove:

- a ready GSLR-35 shell can open a database-binding design-review bead;
- blocked shell state carries forward as review blockers;
- incomplete shell review evidence blocks;
- forbidden database artifacts and read/write execution block;
- reviewer change requests and runtime authority surfaces block.

## Next Step

Open `bead-1284` for database-binding design review. That review may design the
future binding boundary, but must still avoid database client binding,
connection config, generated SQL, secrets, applied migrations, production
tables, read/write execution, runtime cards, production actions, and MC
connector access.
