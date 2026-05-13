# GSLR-33 Persistent Static Repository Executable Adapter Scaffold: 2026-05-13

Status: implemented as docs/test-only domain scaffold
Tracking bead: `bead-1280`

## Decision

`bead-1280` adds an executable adapter scaffold for the persistent static
repository PostgreSQL path.

This scaffold names the adapter surface and method mapping only. It does not
bind a database client, create connection configuration, generate SQL files,
reference secrets, apply migrations, create production tables, enable reads, or
enable writes.

## Gate

The scaffold is gated by GSLR-32:

```text
GSLR-32 executable adapter design review
  -> ready-to-open-executable-adapter-scaffold-bead
  -> GSLR-33 executable adapter scaffold
```

If the design review is blocked, this scaffold blocks and carries the design
review blockers forward.

## What Was Built

The new scaffold contract is:

```text
portarium.gslr-persistent-static-repository-executable-adapter-scaffold.v1
```

The code lives at:

```text
src/domain/evidence/gslr-persistent-static-repository-executable-adapter-scaffold-v1.ts
src/domain/evidence/gslr-persistent-static-repository-executable-adapter-scaffold-v1.test.ts
```

The scaffold records:

- adapter name `GslrPersistentStaticRepositoryPostgresAdapter`;
- port method names for append, get, list, review transition, and audit trail;
- transaction boundary planned but not bound;
- database client binding absent;
- connection config absent;
- generated SQL files absent;
- secret references absent;
- migrations draft-not-applied;
- production tables absent;
- reads and writes blocked;
- contract harness mapping planned but not executed against a database.

## What It Proves

GSLR-33 proves an executable adapter shell can become reviewable before it
becomes operational.

The scaffold is useful because it fixes the adapter surface and future review
target while still blocking the dangerous parts:

- no database client binding;
- no connection config;
- no generated SQL;
- no secrets;
- no applied migrations;
- no production tables;
- no reads or writes;
- no contract harness execution against a database.

## What Blocks

The scaffold blocks when any of these appear:

- design review not ready;
- wrong adapter name;
- implementation mode changed from `scaffold-only`;
- missing port methods;
- bound transaction boundary;
- database client binding;
- connection configuration;
- generated SQL files;
- secret references;
- applied migration;
- created production tables;
- enabled production writes;
- read or write execution enabled;
- contract harness executed against a database;
- missing contract harness mappings;
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
npm run test -- src/domain/evidence/gslr-persistent-static-repository-executable-adapter-scaffold-v1.test.ts src/domain/evidence/gslr-persistent-static-repository-executable-adapter-design-review-v1.test.ts src/domain/evidence/gslr-persistent-static-repository-draft-sql-review-v1.test.ts
```

The focused tests prove:

- a ready design review can create a ready scaffold;
- blocked design-review state carries forward as scaffold blockers;
- executable implementation state and missing port methods block;
- persistence execution and database-bound contract harness state block;
- runtime authority surfaces block.

## Next Step

Open `bead-1281` for scaffold code-review evidence. That review should verify
the adapter shell still has no database client, connection config, generated SQL
files, secrets, applied migrations, production tables, read/write execution,
runtime cards, production actions, or MC connector access.
