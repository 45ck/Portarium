# GSLR-18 Static Imported-Record Repository Design: 2026-05-13

Status: built static repository contract, no production persistence
Tracking bead: `bead-1261`

## Decision

Portarium now has a docs/test-only repository contract for static GSLR imported
records.

The contract lives at:

```text
src/domain/evidence/gslr-static-imported-record-repository-v1.ts
```

It wraps immutable `GslrStaticImportedRecordV1` records in append-only
repository entries. The implementation is an in-memory domain contract for
tests and design review only. It is not wired to a production database, live
manifest importer, queue, SSE stream, runtime Cockpit card, route decision, or
production action path.

## Repository Shape

The repository exposes only:

- `append`;
- `get`;
- `list`;
- `transitionReviewState`;
- `auditTrail`.

It intentionally does not expose `update`, `delete`, `enqueue`, `subscribe`,
`stream`, or `execute`.

Repository entries include:

- the immutable imported record;
- canonical record fingerprint;
- idempotency key;
- append timestamp;
- current review state;
- append-only revision number;
- fixed authority boundary;
- boundary warnings.

The authority boundary is fixed:

```json
{
  "runtimeAuthority": "none",
  "actionControls": "absent",
  "liveEndpoints": "blocked",
  "mutationMode": "append-only-static-records",
  "implementation": "docs-test-only-in-memory-contract"
}
```

## What It Proves

GSLR-18 proves:

- accepted static records can be appended and replayed idempotently;
- rejected/quarantined records can be appended without rendering runtime cards;
- reusing an idempotency key with a different record fingerprint is rejected;
- reusing a record id under a different idempotency key is rejected;
- review-state transitions create new append-only revisions;
- invalid review transitions are rejected;
- audit events record appends, idempotent replays, rejected appends, and review
  transitions;
- records that claim runtime authority, action controls, or live endpoints are
  rejected by the repository contract;
- the repository contract contains no runtime operation surface.

This is a stronger persistence design boundary than GSLR-17, but it is still
domain-only.

## What It Does Not Prove

GSLR-18 does not create or authorize:

- a production database table;
- a live importer;
- prompt-language manifest polling;
- artifact byte fetching;
- keyring promotion from test signatures to production trust;
- Cockpit runtime engineering cards;
- route-record queues;
- SSE streams;
- automatic route decisions from GSLR manifests;
- production actions based on GSLR evidence;
- MacquarieCollege connector observation, source-system reads or writes, or raw
  school-data movement.

## Validation

The implementation was validated with:

```sh
npm run test -- src/domain/evidence/gslr-static-imported-record-repository-v1.test.ts src/domain/evidence/gslr-static-imported-record-v1.test.ts src/domain/evidence/gslr-static-import-readiness-v1.test.ts
npm run typecheck
```

The tests prove:

- idempotent accepted-record appends;
- duplicate conflict rejection;
- constrained review-state transitions through append-only revisions;
- absence of update/delete/runtime/queue/stream operations;
- rejection of imported records that claim live authority.

## Next

The next safe step is GSLR-19: static imported-record importer planning.

It should define the manual importer boundary from verified bundle outcomes into
the repository contract, including artifact-byte fetch policy, production
keyring requirement, operator review defaults, and failure reporting. It should
still avoid production database wiring, live prompt-language polling, runtime
cards, queues, SSE, route decisions, production actions, or MC connector/data
movement.
