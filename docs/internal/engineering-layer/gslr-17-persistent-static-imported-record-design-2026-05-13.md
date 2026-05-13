# GSLR-17 Persistent Static Imported-Record Design: 2026-05-13

Status: built static imported-record contract, no persistence
Tracking bead: `bead-1260`

## Decision

Portarium now has a docs/test-only `GslrStaticImportedRecordV1` contract for
the record shape a future static importer would write after bundle verification
or rejection.

The contract lives at:

```text
src/domain/evidence/gslr-static-imported-record-v1.ts
```

It is not wired to a database, queue, route, SSE stream, runtime card, or
production action path. It is a domain contract and test fixture for the next
design step.

## Record Shape

The record captures:

- record id and source fixture ref;
- import timestamp;
- status: `accepted_static` or `quarantined_rejected`;
- operator review state;
- bundle id, payload hash, and creation time when known;
- prompt-language source repo, commit, run id, and run group id when known;
- task and policy version when known;
- signer key id, algorithm, and trust class;
- verification status;
- structured rejection `code`, `category`, and message for rejected bundles;
- artifact refs, declared hashes, and artifact byte-verification status;
- static authority boundary.

The authority boundary is fixed:

```json
{
  "runtimeAuthority": "none",
  "actionControls": "absent",
  "liveEndpoints": "blocked",
  "persistence": "static-record-design-only"
}
```

## What It Proves

GSLR-17 proves:

- a verified bundle can become an accepted static record without creating
  runtime authority;
- a rejected bundle can become a quarantined static record preserving structured
  rejection code/category;
- signer identity and trust class can be represented without claiming
  production trust for test signatures;
- artifact byte verification status has an explicit place in the future record;
- any verified-record input that claims runtime authority or action controls is
  rejected by the builder.

This is the first concrete shape for future persistent import, but it remains
in-memory/domain-only.

## What It Does Not Prove

GSLR-17 does not create or authorize:

- a database table;
- a repository implementation;
- persistent signed-bundle import;
- live prompt-language manifest ingestion;
- runtime Cockpit engineering cards;
- route-record queues;
- SSE streams;
- automatic route decisions from GSLR manifests;
- production actions based on GSLR evidence;
- MacquarieCollege connector observation, source-system reads or writes, or raw
  school-data movement.

## Validation

The implementation was validated with:

```sh
npm run test -- src/domain/evidence/gslr-static-imported-record-v1.test.ts src/domain/evidence/gslr-static-import-readiness-v1.test.ts src/domain/evidence/gslr-evidence-bundle-v1.test.ts
npm run typecheck
```

The tests prove:

- verified bundles build accepted static records;
- rejected bundles build quarantined static records with code/category;
- runtime authority/action-control claims are rejected;
- an explicit import timestamp is required.

## Next

The next safe step is GSLR-18: static imported-record repository design.

It should define an append-only repository interface, idempotency key, duplicate
handling, review-state transitions, and audit/event boundaries. It should still
avoid implementation wiring to a production database, live ingestion, runtime
cards, queues, SSE, production actions, or MC connector/data movement.
