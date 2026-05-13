# Static Evidence Review-Note Workflow: 2026-05-13

Status: implemented in the internal Static Evidence Review Workbench
Tracking bead: `bead-1267`

## Decision

`bead-1267` defines the static workflow for attaching an exported operator
report packet to a bead or review note.

The workflow remains attached to:

```text
/engineering/evidence-cards/workbench
```

It is a static review workflow only. It does not add live prompt-language
polling, production persistence, queues, SSE, runtime Cockpit cards, production
actions, or MC connector/source-system access.

## Allowed Decision Labels

The Workbench constrains operator decisions to:

```text
attach_static_report_only
accept_static_evidence_no_runtime
block_static_import
quarantine_static_rejected
```

These labels are intentionally narrow:

- `attach_static_report_only` means the report is attached for context only.
- `accept_static_evidence_no_runtime` means the static evidence is acceptable as
  review evidence but grants no runtime authority.
- `block_static_import` means the report should be attached while import remains
  blocked by listed blockers.
- `quarantine_static_rejected` means the report should be attached as rejected
  static evidence for review.

No label authorizes production import, runtime cards, route decisions, actions,
or MC connector access.

## What Was Built

The Workbench now builds:

```text
portarium.gslr-static-evidence-review-note.v1
```

The note is generated from:

- the versioned operator report packet;
- bead or review ref;
- reviewer;
- constrained decision label;
- operator rationale.

The generated output is Markdown for copy/paste into a bead or review note. It
includes:

- note schema version;
- bead/review ref;
- reviewer;
- created timestamp;
- decision label;
- attached report schema, filename, route, record ID, dry-run status, and
  source ref;
- record status, review state, signer trust, artifact byte status,
  verification/rejection, blockers, and audit event;
- rationale;
- static-only boundary warning.

## What It Proves

The Workbench now has the full static handoff loop:

```text
static dry-run
  -> versioned report packet
  -> constrained review-note decision
  -> copyable bead/review Markdown
```

This lets operators record a decision without inventing persistence or runtime
automation too early.

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

- constrained decision labels are fixed;
- note generation links to the exported report packet;
- generated Markdown includes decision, bead ref, report filename, and
  static-only boundary;
- note objects are frozen;
- copying the note uses browser-local clipboard APIs;
- the note interaction makes no `fetch` calls.

## Next Step

The next safe item is to split production keyring and artifact-byte verification
design. That work should define interfaces and blockers only. It must not add
live polling, production persistence, runtime cards, actions, or MC connector
access.
