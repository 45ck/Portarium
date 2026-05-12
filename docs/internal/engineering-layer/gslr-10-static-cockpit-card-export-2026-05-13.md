# GSLR-10 Static Cockpit Card Export: 2026-05-13

Status: docs/test-only Cockpit export contract, no runtime ingestion  
Tracking bead: `bead-1250`

## Decision

Portarium now has a static Cockpit-facing export for engineering evidence cards:

```text
src/domain/evidence/engineering-evidence-card-cockpit-export-v1.ts
```

This is the product-safe follow-up to GSLR-9. GSLR-9 proved checked-in GSLR
route evidence can become a valid `EngineeringEvidenceCardInputV1`. GSLR-10
proves that card can become a frozen, operator-readable Cockpit view model
without creating live ingestion or runtime cards.

## Why

The next uncertainty was operator legibility, not automation.

GSLR-8 showed that local models can be useful when Prompt Language owns the
policy tables, output envelopes, route decisions, and escalation ordering.
GSLR-9 then projected that evidence into a static card. GSLR-10 asks the next
question:

```text
Can an operator understand the route, model, gates, cost, artifacts, and
boundary from a static Cockpit export without mistaking it for production work?
```

## Contract

The builder accepts `unknown`, parses it through
`parseEngineeringEvidenceCardInputV1`, and emits
`EngineeringEvidenceCardCockpitExportV1`.

The export includes:

- `contentType: application/vnd.portarium.engineering-evidence-card+json`;
- `routeHint: /cockpit/engineering/evidence-cards/static`;
- title and source/run subtitle;
- route, model, and action-boundary badges;
- frontier-token, cached-token, provider-cost, and local-wall-time rows;
- final-verdict, private-oracle, and review-defect gate rows;
- artifact refs only;
- mandatory boundary warnings.

The export is deeply frozen so later renderers cannot silently mutate the static
evidence model.

## What It Proves

- GSLR-8 positive evidence renders as `research-only`, `local-screen`, and zero
  frontier tokens.
- GSLR-7 failed route-record evidence renders as `blocked` with failing gate
  rows.
- Raw payload fields are rejected before export by the existing evidence-card
  parser.
- Static Cockpit presentation can carry the boundary warnings needed before any
  UI route or runtime ingestion exists.

## Still Blocked

Do not create:

- live prompt-language manifest ingestion;
- live Cockpit engineering cards;
- Cockpit routes backed by GSLR runtime data;
- route-record queues;
- route-record database tables;
- runtime decisions from GSLR manifests;
- MC connector observation or school-data movement.

## Validation

Focused validation:

```sh
npm run test -- \
  src/domain/evidence/engineering-evidence-card-cockpit-export-v1.test.ts \
  src/domain/evidence/gslr-engineering-evidence-card-projection-v1.test.ts \
  src/domain/evidence/engineering-evidence-card-v1.test.ts
```

Result:

```text
Test Files  3 passed (3)
Tests       14 passed (14)
```

## Execution Record

2026-05-13:

- Added the static Cockpit export builder for engineering evidence cards.
- Added tests for GSLR-8 positive export, GSLR-7 blocked export, raw-payload
  rejection, and deep immutability.
- Exported the contract from the domain evidence barrel.
- Kept runtime ingestion, live Cockpit cards, queues, database tables, and MC
  connector work blocked.

Progress checkpoint follow-up:
`gslr-progress-checkpoint-2026-05-13.md` summarizes the current conclusion across
GSLR-1 through GSLR-10 and names GSLR-11 static Cockpit fixture/view proof as the
next product-safe step.
