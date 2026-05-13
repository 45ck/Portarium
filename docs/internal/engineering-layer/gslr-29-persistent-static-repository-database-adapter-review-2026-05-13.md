# GSLR-29 Persistent Static Repository Database-Adapter Review: 2026-05-13

Status: implemented as docs/test-only domain review checkpoint
Tracking bead: `bead-1276`

## Decision

`bead-1276` adds a review checkpoint before any persistent static repository
database adapter is built.

The checkpoint decides one narrow question: is the GSLR-28 contract-harness
adapter sufficient for now, or should Portarium open a draft PostgreSQL adapter
bead behind the same contract?

The recommended outcome is to pause at the contract harness while operator,
product, and engineering review are requested.

This is still not a production database adapter. It does not apply migrations,
create production tables, write production state, poll prompt-language, create
queues, open SSE streams, create runtime cards, execute production actions, or
access MC connectors.

## Gate

The checkpoint is gated by GSLR-28:

```text
GSLR-28 contract-harness adapter
  -> contract-harness-only
  -> migrations unapplied
  -> production tables absent
  -> production writes disabled
  -> GSLR-29 database-adapter review checkpoint
```

If the harness metadata is missing, blocked, production-shaped, or already
connected to real database state, the checkpoint blocks database-adapter work.

## What Was Built

The new review contract is:

```text
portarium.gslr-persistent-static-repository-database-adapter-review.v1
```

The code lives at:

```text
src/domain/evidence/gslr-persistent-static-repository-database-adapter-review-v1.ts
src/domain/evidence/gslr-persistent-static-repository-database-adapter-review-v1.test.ts
```

It can return four statuses:

- `pause-at-contract-harness`;
- `ready-to-open-draft-postgres-adapter-bead`;
- `do-not-build-database-adapter`;
- `blocked`.

## What Opens a Draft PostgreSQL Adapter Bead

A draft adapter bead can open only when all of these are true:

- the harness adapter schema is GSLR-28 contract-harness adapter v1;
- adapter kind remains `contract-harness-only`;
- contract status is `ready-for-adapter-code-review`;
- migrations are not applied;
- production tables are not created;
- production writes are not enabled;
- operator, product, and engineering all approve a draft adapter;
- database-adapter value is confirmed;
- proposed adapter kind is `draft-postgres-adapter`;
- migrations remain unapplied;
- production writes remain disabled;
- contract tests are required;
- rollback plan is required;
- live prompt-language polling, queues, SSE streams, runtime cards, production
  actions, and MC connector access remain blocked or absent.

That outcome opens only a draft adapter bead. It does not authorize production
database wiring.

## What Blocks

The checkpoint blocks when any of these appear:

- missing or invalid harness metadata;
- production adapter kind;
- blocked adapter contract status;
- applied migrations;
- created production tables;
- enabled production writes;
- proposed production PostgreSQL adapter;
- missing contract-test or rollback safeguards;
- live prompt-language polling;
- queues;
- SSE streams;
- runtime cards;
- production actions;
- MC connector access.

## Valid Stop Decision

Declining the database adapter is a valid outcome:

```text
do-not-build-database-adapter
```

That is not treated as malformed. It means the contract-harness adapter remains
the stopping point until a later review changes the decision.

## What It Proves

GSLR-29 proves that Portarium can insert a governance checkpoint between a
passing contract-harness adapter and any real database adapter work.

It keeps the persistent repository sequence honest:

- contract behavior can be proven before storage is built;
- production storage cannot appear as a side effect of adapter work;
- the review can explicitly decline database work without breaking the evidence
  chain;
- a draft PostgreSQL adapter, if opened later, must remain non-production,
  test-backed, rollback-planned, and migration-disabled.

## What Remains Blocked

Still blocked:

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
npm run test -- src/domain/evidence/gslr-persistent-static-repository-database-adapter-review-v1.test.ts src/domain/evidence/gslr-persistent-static-repository-contract-harness-adapter-v1.test.ts
```

The focused tests prove:

- the recommended checkpoint pauses at the contract harness;
- explicit operator, product, and engineering approval can open only a draft
  PostgreSQL adapter bead;
- decline is a valid stop decision;
- invalid harness metadata, applied migrations, production tables, production
  writes, production adapter scope, missing safeguards, runtime surfaces,
  actions, and MC connector access block.

## Next Step

If review approves database-adapter value, open `bead-1277` for a draft
PostgreSQL adapter contract/scaffold behind the GSLR-27 contract. That bead must
keep migrations unapplied, production writes disabled, live polling absent,
runtime cards absent, production actions blocked, and MC connector access
blocked.

If review does not approve the adapter, stop at the contract-harness adapter.
