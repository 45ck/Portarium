# GSLR-28 Persistent Static Repository Contract-Harness Adapter: 2026-05-13

Status: implemented as docs/test-only domain adapter
Tracking bead: `bead-1275`

## Decision

`bead-1275` implements a contract-harness adapter for the persistent static
repository port.

This is still not a production database adapter. It does not apply migrations,
create production tables, write production state, poll prompt-language, create
queues, open SSE streams, create runtime cards, execute production actions, or
access MC connectors.

## Gate

The adapter is gated by GSLR-27:

```text
GSLR-27 adapter contract harness
  -> ready-for-adapter-code-review
  -> GSLR-28 contract-harness adapter
```

If the adapter contract is not ready, the adapter constructor fails.

## What Was Built

The new adapter contract is:

```text
portarium.gslr-persistent-static-repository-contract-harness-adapter.v1
```

The code lives at:

```text
src/domain/evidence/gslr-persistent-static-repository-contract-harness-adapter-v1.ts
src/domain/evidence/gslr-persistent-static-repository-contract-harness-adapter-v1.test.ts
```

The adapter exposes only:

- `appendStaticImportedRecord`;
- `getStaticImportedRecord`;
- `listStaticImportedRecords`;
- `transitionStaticImportedRecordReviewState`;
- `auditTrailForStaticImportedRecord`.

It omits:

- update operations;
- delete operations;
- prompt-language polling;
- runtime-card subscription;
- action execution;
- MC connector reads.

## What It Proves

The harness adapter satisfies the GSLR-27 assertions:

- accepted static records append without runtime authority;
- identical idempotency keys replay without duplicate writes;
- conflicting idempotency keys reject;
- reused record IDs under different idempotency keys reject;
- canonical JSON fingerprints are stored;
- raw payload fields reject;
- review transitions are constrained and require actor/reason;
- audit events remain append-only;
- missing record reads return null;
- forbidden runtime operations are absent.

## Harness Metadata

The adapter metadata records:

- adapter kind is `contract-harness-only`;
- migrations are not applied;
- production tables are not created;
- production writes are not enabled;
- live prompt-language polling is blocked;
- queues are absent;
- SSE streams are absent;
- runtime cards are absent;
- production actions are blocked;
- MC connector access is blocked.

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
npm run test -- src/domain/evidence/gslr-persistent-static-repository-contract-harness-adapter-v1.test.ts
```

The focused tests prove:

- only the persistent static repository port is exposed;
- adapter metadata keeps migrations, tables, writes, queues, streams, runtime
  cards, actions, and MC connector access blocked;
- accepted append, idempotent replay, fingerprint storage, get/list, and audit
  trail work;
- idempotency and record ID conflicts reject;
- raw payload storage and runtime authority reject;
- constrained review transitions and missing-record reads work.

## Next Step

Open a review checkpoint before any database adapter. The checkpoint should
decide whether the harness adapter is sufficient for now or whether a draft
Postgres adapter should be built behind the same contract with migrations still
unapplied.
