# GSLR-22 Persistent Static Storage Design: 2026-05-13

Status: implemented as docs/test-only domain contract
Tracking bead: `bead-1269`

## Decision

`bead-1269` defines the persistent static imported-record storage design gate.

This is still a design/test contract. It does not add database migrations,
production tables, live prompt-language polling, queues, SSE streams, runtime
Cockpit cards, production actions, or MC connector/source-system access.

## What Was Built

The new contract is:

```text
portarium.gslr-persistent-static-imported-record-storage-design.v1
```

The code lives at:

```text
src/domain/evidence/gslr-persistent-static-imported-record-storage-design-v1.ts
src/domain/evidence/gslr-persistent-static-imported-record-storage-design-v1.test.ts
```

The recommended design requires:

- upstream static verification gate ready;
- production keyring ready;
- artifact bytes ready;
- append-only static record store;
- append-only mutation model;
- required idempotency;
- canonical JSON SHA-256 record fingerprint;
- duplicate policy that rejects conflicts and replays identical appends;
- append-only audit events;
- constrained review-state transitions;
- actor and reason required for review transitions;
- deletion prohibited;
- static export permitted for review packets;
- raw payload storage forbidden;
- runtime authority `none`;
- action controls `absent`;
- live endpoints `blocked`;
- queues `absent`;
- SSE streams `absent`;
- MC connector access `blocked`.

## What It Blocks

The evaluator blocks:

- missing verification gate readiness;
- keyring not ready;
- artifact bytes not ready;
- general-purpose database target as the design default;
- runtime card store target;
- upsert or mutable-update storage;
- optional idempotency;
- absent record fingerprinting;
- overwrite duplicate policy;
- last-write-only audit trail;
- free-form review transitions;
- missing actor or reason on review transitions;
- deletion;
- raw payload storage;
- runtime route-decision or action authority;
- action controls;
- live endpoints;
- queues;
- SSE streams;
- MC connector access.

## What It Proves

The storage boundary is now explicit:

```text
static verification design ready
  -> persistent static storage design gate
  -> future storage implementation bead
```

The design keeps static evidence useful for review without turning it into a
runtime system. The future storage implementation must be append-only,
idempotent, fingerprinted, audited, and unable to execute or route work.

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
npm run test -- src/domain/evidence/gslr-persistent-static-imported-record-storage-design-v1.test.ts
```

The focused tests prove:

- the recommended design is ready after verification gate readiness;
- missing verification/keyring/artifact readiness blocks storage design;
- mutable, overwrite, and last-write-only storage designs are blocked;
- free-form review, deletion, raw payload storage, runtime authority, queues,
  SSE, live endpoints, and MC connector access are blocked;
- design and result objects are frozen.

## Next Step

The next safe item is an implementation-readiness checklist for the eventual
persistent static repository. It should map this storage design to concrete
future implementation requirements and remain docs/test-only until a separate
implementation bead is opened.
