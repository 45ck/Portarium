# GSLR-34 Persistent Static Repository Scaffold Code Review: 2026-05-13

Status: implemented as docs/test-only domain review evidence
Tracking bead: `bead-1281`

## Decision

`bead-1281` adds scaffold code-review evidence for the persistent static
repository PostgreSQL adapter shell.

This review verifies that the GSLR-33 scaffold remains unbound and
non-operational. It does not authorize a database client, connection
configuration, generated SQL files, secrets, applied migrations, production
tables, reads, or writes.

## Gate

The review is gated by GSLR-33:

```text
GSLR-33 executable adapter scaffold
  -> ready-for-scaffold-code-review
  -> GSLR-34 scaffold code-review evidence
```

If the scaffold is blocked, this review blocks and carries the scaffold blockers
forward.

## What Was Built

The new review contract is:

```text
portarium.gslr-persistent-static-repository-scaffold-code-review.v1
```

The code lives at:

```text
src/domain/evidence/gslr-persistent-static-repository-scaffold-code-review-v1.ts
src/domain/evidence/gslr-persistent-static-repository-scaffold-code-review-v1.test.ts
```

The review verifies:

- adapter shell reviewed;
- port method surface reviewed;
- transaction boundary still unbound;
- contract harness still planned-only;
- boundary warnings reviewed;
- database client binding absent;
- connection config absent;
- generated SQL files absent;
- secret references absent;
- applied migrations absent;
- production tables absent;
- reads and writes blocked.

## What It Proves

GSLR-34 proves the scaffold can pass a code-review evidence gate without
becoming operational.

This matters because an "adapter scaffold" can drift into real persistence if a
database client, connection config, generated SQL, secrets, migrations, or
read/write execution appear early. This review keeps those artifacts blocked.

## What Blocks

The review blocks when any of these appear:

- scaffold not ready;
- unreviewed adapter shell;
- unreviewed port method surface;
- bound transaction boundary;
- contract harness no longer planned-only;
- unreviewed boundary warnings;
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
npm run test -- src/domain/evidence/gslr-persistent-static-repository-scaffold-code-review-v1.test.ts src/domain/evidence/gslr-persistent-static-repository-executable-adapter-scaffold-v1.test.ts src/domain/evidence/gslr-persistent-static-repository-executable-adapter-design-review-v1.test.ts
```

The focused tests prove:

- a ready scaffold can open an unbound adapter shell bead;
- blocked scaffold state carries forward as review blockers;
- incomplete code-review evidence blocks;
- forbidden database artifacts and read/write execution block;
- reviewer change requests and runtime authority surfaces block.

## Next Step

Open `bead-1282` for an unbound adapter shell contract. That shell must still
avoid database clients, connection config, generated SQL files, secrets, applied
migrations, production tables, read/write execution, runtime cards, production
actions, and MC connector access.

The unbound adapter shell contract is recorded in
[`gslr-35-persistent-static-repository-unbound-adapter-shell-2026-05-13.md`](./gslr-35-persistent-static-repository-unbound-adapter-shell-2026-05-13.md).
