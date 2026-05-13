# GSLR-19 Static Imported-Record Importer Planning: 2026-05-13

Status: built static importer planning contract, no importer runtime
Tracking bead: `bead-1262`

## Decision

Portarium now has a docs/test-only planning contract for converting a manual
verified or rejected static GSLR bundle outcome into a repository append
request.

The contract lives at:

```text
src/domain/evidence/gslr-static-imported-record-importer-plan-v1.ts
```

It is a planner only. It does not fetch artifact bytes, poll prompt-language
manifests, write a database, call live endpoints, append to the repository,
create queues, create SSE streams, render runtime cards, make route decisions,
or execute production actions.

## Planning Shape

The planner requires:

- manual operator submission;
- artifact byte policy of `fetch-and-hash-before-append`;
- production keyring requirement;
- append-only static repository target;
- structured rejection-code failure reporting;
- no runtime authority;
- no action controls;
- blocked live endpoints.

For verified records, the planner also requires:

- `accepted_static` status;
- configured verified review default;
- production-keyring signer trust;
- verified artifact bytes.

For rejected records, the planner requires:

- `quarantined_rejected` status;
- configured rejected review default;
- preserved structured rejection details.

The planner derives the repository idempotency key from the source ref, record
id, and payload hash or rejection code. A ready plan carries a
`GslrStaticImportedRecordRepositoryAppendInputV1`. A blocked plan carries no
append input and instead lists blockers.

## What It Proves

GSLR-19 proves:

- verified bundle outcomes can be planned as accepted static repository append
  requests;
- rejected bundle outcomes can be planned as quarantined static repository
  append requests;
- importer readiness blockers are explicit before an append input exists;
- test-fixture trust and declared-only artifact hashes block accepted imports;
- live manifest polling, production database targets, runtime authority, action
  controls, and live endpoints block planning;
- imported records that claim live authority are rejected by the planner.

This is the first concrete importer boundary, but it remains planning-only.

## What It Does Not Prove

GSLR-19 does not create or authorize:

- a live importer;
- prompt-language manifest polling;
- artifact byte fetching;
- a production database table;
- repository writes from a route or UI;
- production keyring integration;
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
npm run test -- src/domain/evidence/gslr-static-imported-record-importer-plan-v1.test.ts src/domain/evidence/gslr-static-imported-record-repository-v1.test.ts src/domain/evidence/gslr-static-imported-record-v1.test.ts
npm run typecheck
```

The tests prove:

- accepted-record append planning;
- quarantined rejected-record append planning;
- readiness blocker reporting;
- live/polling/runtime authority rejection;
- record-level live authority rejection.

## Next

The next safe step is GSLR-20: static importer dry-run fixture.

It should exercise the planner against checked-in verified and rejected bundle
fixtures and repository contract in a dry-run test path only. It should still
avoid production database wiring, live prompt-language polling, runtime cards,
queues, SSE, route decisions, production actions, or MC connector/data movement.
