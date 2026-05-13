# GSLR-27 Persistent Static Repository Adapter Contract: 2026-05-13

Status: implemented as docs/test-only domain contract
Tracking bead: `bead-1274`

## Decision

`bead-1274` adds adapter contract tests for the persistent static repository
port without creating a production adapter.

The contract is a harness gate only. It does not apply migrations, create
production tables, write production state, poll prompt-language, create queues,
open SSE streams, create runtime cards, execute production actions, or access MC
connectors.

## Gate

The adapter contract is gated by GSLR-26:

```text
GSLR-26 implementation contract
  -> ready-for-code-review
  -> GSLR-27 adapter contract harness
```

If the implementation contract is blocked, adapter testing is blocked.

## What Was Built

The new contract is:

```text
portarium.gslr-persistent-static-repository-adapter-contract.v1
```

The code lives at:

```text
src/domain/evidence/gslr-persistent-static-repository-adapter-contract-v1.ts
src/domain/evidence/gslr-persistent-static-repository-adapter-contract-v1.test.ts
```

The recommended adapter under test is `contract-harness-only`.

It requires:

- migrations not applied;
- production tables not created;
- production writes not enabled;
- no live prompt-language polling;
- no queues;
- no SSE streams;
- no runtime cards;
- no production actions;
- no MC connector access.

## Required Adapter Assertions

Any future adapter must prove:

- append accepted static imported record without runtime authority;
- replay identical idempotency key without duplicate write;
- reject idempotency key reused with a different record fingerprint;
- reject record ID reused under a different idempotency key;
- persist canonical JSON SHA-256 record fingerprint;
- reject raw payload storage;
- enforce constrained review transitions with actor and reason;
- record append-only audit trail events;
- return null for missing record reads;
- expose no update, delete, queue, stream, runtime-card, action, or MC connector
  operations.

## What It Blocks

The evaluator blocks:

- implementation contract not ready for code review;
- production adapter kind;
- applied migrations;
- production tables;
- production writes;
- missing adapter contract cases;
- live prompt-language polling;
- queues;
- SSE streams;
- runtime cards;
- production actions;
- MC connector access.

## What This Proves

This proves the next implementation work can be reviewed as adapter behavior
before it becomes database behavior.

The next safe step is a contract-harness adapter implementation that satisfies
these assertions. That step still should not apply migrations or enable
production writes.

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
npm run test -- src/domain/evidence/gslr-persistent-static-repository-adapter-contract-v1.test.ts
```

The focused tests prove:

- the recommended contract harness is ready for adapter code review;
- blocked implementation contracts block adapter testing;
- production adapters, applied migrations, tables, and writes block;
- missing contract coverage blocks;
- runtime authority surfaces block;
- contract and result objects are frozen.

## Next Step

Open a follow-up contract-harness adapter bead. It should implement an adapter
against the GSLR-26 port and GSLR-27 assertions while migrations remain
unapplied and production writes remain disabled.

Update: `bead-1275` has now implemented that contract-harness adapter in
[`gslr-28-persistent-static-repository-contract-harness-adapter-2026-05-13.md`](./gslr-28-persistent-static-repository-contract-harness-adapter-2026-05-13.md).
