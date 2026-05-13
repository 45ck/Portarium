# GSLR-26 Persistent Static Repository Port and Draft Migration: 2026-05-13

Status: implemented as docs/test-only domain contract
Tracking bead: `bead-1273`

## Decision

`bead-1273` starts the narrow persistent static repository implementation path,
but only at the contract level.

It adds a persistent static repository port specification and an unapplied draft
migration contract. It does not apply migrations, create production tables,
write production state, poll prompt-language, create queues, open SSE streams,
create runtime cards, execute production actions, or access MC connectors.

## Gate

The implementation contract is gated by GSLR-25:

```text
GSLR-25 review packet status
  -> ready-to-open-implementation-bead
  -> GSLR-26 port and draft migration contract
```

If the review packet is still `ready-for-static-review`, declined, or blocked,
GSLR-26 blocks.

## What Was Built

The new contract is:

```text
portarium.gslr-persistent-static-repository-implementation.v1
```

The code lives at:

```text
src/domain/evidence/gslr-persistent-static-repository-implementation-v1.ts
src/domain/evidence/gslr-persistent-static-repository-implementation-v1.test.ts
```

The repository port allows only:

- append static imported record;
- get static imported record;
- list static imported records;
- transition static imported record review state;
- read audit trail for a static imported record.

It explicitly forbids:

- update static imported record;
- delete static imported record;
- poll prompt-language;
- subscribe runtime cards;
- execute action;
- read MC connector.

## Draft Migration Contract

The draft migration is explicitly `draft-not-applied`.

It lists the future tables:

- `gslr_static_imported_records`;
- `gslr_static_imported_record_audit_events`.

It requires:

- `unique(idempotency_key)`;
- `unique(record_id)`;
- canonical JSON SHA-256 record fingerprint check;
- raw payload is null;
- constrained static review states;
- append-only audit event table;
- draft-only rollback plan.

## What It Blocks

The evaluator blocks:

- review packet not approved for implementation;
- missing repository port operations;
- incomplete forbidden-operation list;
- non-append-only semantics;
- missing idempotency key requirement;
- missing canonical JSON SHA-256 fingerprint requirement;
- raw payload storage;
- unconstrained review transitions;
- applied migrations;
- production tables already created;
- production writes enabled;
- missing draft tables or constraints;
- mutable/missing audit event table;
- destructive production rollback;
- live prompt-language polling;
- queues;
- SSE streams;
- runtime cards;
- production actions;
- MC connector access.

## What This Proves

This is the first real engineering step after the research/design gates, but it
is still not production persistence. It proves the implementation surface can be
specified narrowly enough for code review before any adapter or database wiring
exists.

The next safe step is adapter contract testing against this port shape, still
without applying migrations or enabling production writes.

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
npm run test -- src/domain/evidence/gslr-persistent-static-repository-implementation-v1.test.ts
```

The focused tests prove:

- the approved review packet opens the port/draft migration contract;
- unapproved review packets block implementation;
- missing port operations and unsafe semantics block;
- applied migrations, production tables/writes, and missing constraints block;
- runtime authority surfaces block;
- implementation and result objects are frozen.

## Next Step

Open a follow-up adapter-contract bead only after this contract is reviewed. The
adapter bead should test an implementation against this port and draft migration
shape without applying migrations or enabling production writes.
