# Static Evidence Operator Report Export: 2026-05-13

Status: implemented in the internal Static Evidence Review Workbench
Tracking bead: `bead-1266`

## Decision

`bead-1266` turns the Workbench's operator report text into a versioned static
JSON report packet.

The export remains attached to:

```text
/engineering/evidence-cards/workbench
```

It is a review artifact only. It does not add live prompt-language polling,
production persistence, queues, SSE, runtime Cockpit cards, production actions,
or MC connector/source-system access.

## What Was Built

The Workbench now builds:

```text
portarium.gslr-static-evidence-workbench-operator-report.v1
```

The packet includes:

- route and content type;
- deterministic filename;
- generated timestamp from the static dry-run record;
- dry-run status;
- source ref;
- record ID, record status, and review state;
- signer trust;
- artifact byte-verification statuses;
- structured verification or rejection code/category;
- append-plan status, idempotency key, and blockers;
- repository dry-run entry count, audit event, and append rejection;
- dry-run boundary warnings;
- the human-readable report text.

The UI exposes:

- `Copy JSON`, for attaching the packet to a bead or review note;
- `Download JSON`, for saving the packet as a local static artifact.

## What It Proves

The Workbench now has a portable operator handoff:

```text
static dry-run
  -> versioned report packet
  -> bead/review attachment
```

This is the smallest useful artifact boundary before persistence. It lets the
team review accepted, blocked, or quarantined evidence without inventing a
database table, queue, stream, or runtime card.

## What Remains Blocked

Still blocked:

- live prompt-language manifest polling;
- production keyring integration;
- artifact byte fetching from live sources;
- production imported-record persistence;
- production imported-record repository implementation;
- route-record queues or database tables;
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
npm run -w apps/cockpit test -- src/components/cockpit/gslr-static-evidence-workbench.test.tsx
```

The focused tests prove:

- packet schema, route, blockers, boundary warnings, report text, and filename;
- JSON serialization is parseable and deterministic for the dry-run result;
- packet objects are deeply frozen;
- copy/download UI works through browser-local APIs;
- the export interaction makes no `fetch` calls.

## Next Step

The next safe item is a static review-note workflow: define how a copied report
packet is attached to a bead/review note and what operator decision labels are
allowed. That should still be docs/test-only and must not add persistence,
runtime cards, live endpoints, actions, or MC connector/source-system access.
