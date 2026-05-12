# GSLR-11 Static Cockpit Fixture View: 2026-05-13

Status: static Cockpit fixture/view proof, no runtime ingestion  
Tracking bead: `bead-1252`

## Decision

Portarium now has a Cockpit route that renders static GSLR engineering evidence
card exports:

```text
/engineering/evidence-cards/static
```

The route is fixture-backed only. It renders checked-in GSLR-8 and GSLR-7
evidence-card export fixtures through a reusable Cockpit component, with no
prompt-language manifest ingestion, no GSLR database table, no route-record
queue, no SSE stream, and no action controls.

## Why

GSLR-10 proved that static engineering evidence cards can become frozen
Cockpit-facing view models. GSLR-11 answers the next product question:

```text
Can Cockpit display the evidence honestly enough that an operator sees the
route, model, gates, cost, artifacts, and blocked/research-only boundary before
any runtime ingestion exists?
```

This is the right next step because the research result is now about operator
legibility, not more automation.

## What It Proves

- GSLR-8 appears as `research-only`, `local-screen via local-only`, zero
  frontier tokens, zero provider cost, passing gates, and artifact refs.
- GSLR-7 appears as `blocked`, `frontier-baseline via local-only`, failing
  gates, one blocking review defect, and artifact refs.
- The static route can show promoted and blocked evidence together instead of
  hiding failed attempts.
- The visible surface carries boundary warnings for no live ingestion, no
  runtime queues/tables/streams, and no MacquarieCollege connector observation
  or data movement.
- The reusable card component renders no action buttons.

## What It Does Not Prove

GSLR-11 does not prove runtime trust. It does not validate:

- live prompt-language manifest ingestion;
- signed evidence bundle import;
- Cockpit routes backed by runtime GSLR data;
- route-record queues;
- route-record database tables;
- automatic route decisions from GSLR manifests;
- production action paths;
- MC connector reads, writes, observation, or raw data movement.

## Implementation

Static fixture/view files:

```text
apps/cockpit/src/components/cockpit/gslr-static-evidence-card-fixtures.ts
apps/cockpit/src/components/cockpit/gslr-static-evidence-card-view.tsx
apps/cockpit/src/routes/engineering/evidence-cards/static.tsx
```

Focused tests:

```text
apps/cockpit/src/components/cockpit/gslr-static-evidence-card-view.test.tsx
apps/cockpit/src/routes/engineering/static-evidence-cards.test.tsx
```

The route is gated by `shouldShowInternalCockpitSurfaces()` like other internal
engineering surfaces. The fixtures intentionally live outside `mocks/fixtures`
because this is a static product proof, not a test mock imported into production
code.

## Validation

Focused Cockpit tests:

```sh
npm run -w apps/cockpit test -- \
  src/components/cockpit/gslr-static-evidence-card-view.test.tsx \
  src/routes/engineering/static-evidence-cards.test.tsx
```

Result:

```text
Test Files  2 passed (2)
Tests       2 passed (2)
```

Cockpit production build:

```sh
npm run -w apps/cockpit build
```

Result:

```text
tsc -b tsconfig.app.json && vite build
✓ built
```

## Conclusion

The local/frontier/Prompt Language split is now legible in Cockpit as static
operator evidence:

```text
Prompt Language owns the scaffold and evidence shape.
Local models fill bounded hooks when promoted by repeated evidence.
Frontier/Codex remains the advisor, planner, and escalation lane.
Portarium displays the decision boundary before any action is possible.
```

The next safe step is not live ingestion yet. The next step should be a manual
signed-bundle design/proof: define how a checked-in or uploaded GSLR evidence
bundle would be authenticated, parsed, shown as static evidence, and explicitly
kept separate from runtime action execution.
