# GSLR-23 Persistent Static Repository Implementation Readiness: 2026-05-13

Status: implemented as docs/test-only domain contract
Tracking bead: `bead-1270`

## Decision

`bead-1270` defines the checklist that must pass before opening a future
persistent static repository implementation bead.

This is not the implementation. It does not add database migrations, production
tables, production writes, live prompt-language polling, queues, SSE streams,
runtime Cockpit cards, production actions, or MC connector/source-system access.

## What Was Built

The new contract is:

```text
portarium.gslr-persistent-static-repository-implementation-readiness.v1
```

The code lives at:

```text
src/domain/evidence/gslr-persistent-static-repository-implementation-readiness-v1.ts
src/domain/evidence/gslr-persistent-static-repository-implementation-readiness-v1.test.ts
```

The recommended checklist requires:

- persistent static storage design ready;
- no database migrations started;
- no production tables present;
- no production writes present;
- repository port specified;
- append-only schema specified;
- idempotency unique constraint specified;
- canonical JSON SHA-256 fingerprint constraint specified;
- audit-event schema specified;
- review-state transition table specified;
- migration plan drafted but not applied;
- backup/restore plan drafted;
- static-only observability plan drafted;
- delete-prohibited retention plan drafted;
- verification-gate dependency documented;
- raw payload storage forbidden;
- runtime authority policy `none`;
- MC connector access blocked.

## Required Future Implementation Artifacts

A future implementation bead must produce:

- repository port interface and contract tests;
- append-only static record table migration draft;
- idempotency unique constraint and replay behavior tests;
- canonical JSON SHA-256 record fingerprint constraint tests;
- append-only audit event table migration draft;
- constrained review-state transition tests;
- backup/restore and retention runbook;
- static-only observability plan with no SSE or runtime cards;
- verification-gate dependency check before writes.

## What It Blocks

The evaluator blocks:

- storage design not ready;
- storage design not targeting an append-only static record store;
- already-applied migrations;
- existing production tables;
- existing production writes;
- missing repository port/schema/constraint/audit/review plans;
- missing migration, backup/restore, observability, or retention plan;
- live-streaming observability;
- delete-allowed retention;
- missing verification-gate dependency;
- raw payload storage;
- runtime authority;
- MC connector access.

## What It Proves

The implementation path is now explicit:

```text
storage design gate
  -> implementation-readiness checklist
  -> future implementation bead
```

This avoids accidentally sliding from static design into production storage. The
future implementation bead can be opened only after the checklist is green and
must still prove append-only, idempotent, fingerprinted, audited behavior before
any production use.

## What Remains Blocked

Still blocked:

- database migrations;
- production imported-record tables;
- production imported-record repository implementation;
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
npm run test -- src/domain/evidence/gslr-persistent-static-repository-implementation-readiness-v1.test.ts
```

The focused tests prove:

- the recommended checklist is ready to open a future implementation bead;
- blocked storage design blocks readiness;
- already-applied migrations/tables/writes block readiness;
- missing contract and operational plans block readiness;
- raw payload storage, runtime authority, and MC connector access policies block
  readiness;
- checklist and result objects are frozen.

## Next Step

The next safe item is a stop-and-review checkpoint. The project now has enough
static gates to decide whether to open a real implementation bead or pause for
operator/product review.
