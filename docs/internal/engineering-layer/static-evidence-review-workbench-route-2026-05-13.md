# Static Evidence Review Workbench Route: 2026-05-13

Status: implemented as internal Cockpit route
Tracking bead: `bead-1265`

## Decision

`bead-1265` implements the first operator-visible Static Evidence Review
Workbench route over the GSLR-20 dry-run contract.

The route is:

```text
/engineering/evidence-cards/workbench
```

The route is internal-gated and static-only. It does not add live
prompt-language polling, production persistence, queues, SSE, route-record
tables, runtime Cockpit cards, production actions, or MC connector/source-system
access.

## What Was Built

The route and component live at:

```text
apps/cockpit/src/routes/engineering/evidence-cards/workbench.tsx
apps/cockpit/src/components/cockpit/gslr-static-evidence-workbench.tsx
```

The workbench lets an operator:

- load deterministic static fixtures;
- paste bundle JSON;
- run the GSLR-20 dry-run in memory;
- see accepted, blocked, and quarantined states;
- inspect signer trust;
- inspect artifact byte status;
- inspect structured rejection code/category;
- inspect append-plan status and blockers;
- inspect in-memory repository entry count and audit event;
- view a static operator report text block.

The route is also added to the internal engineering navigation as `GSLR
Workbench`.

## Fixtures

The workbench includes static fixtures for:

- GSLR-8 production-keyring-shaped accepted dry-run;
- GSLR-8 deterministic test-signature fixture blocked from accepted import;
- GSLR-8 production-keyring-shaped fixture with artifact bytes not fetched,
  blocked from accepted import;
- invalid-signature bundle quarantined with structured rejection details;
- runtime-authority adversarial bundle quarantined without gaining runtime
  authority.

The accepted fixture is production-keyring-shaped only for static dry-run
acceptance. It is not production keyring integration.

## What It Proves

The workbench proves the GSLR evidence loop is now operator-visible:

```text
static bundle
  -> in-memory dry-run
  -> imported-record preview
  -> append plan or blockers
  -> repository dry-run state
  -> audit event
  -> static operator report
```

It also proves the route can exercise the dry-run without calling additional
live endpoints during the dry-run interaction.

Focused route tests clear existing shell bootstrap calls before exercising the
workbench and assert the workbench interaction makes no fetch calls to live run,
evidence, work-item, human-task, workforce, route-record, SSE, action,
prompt-language polling, importer, connector, Macquarie, or school endpoints.

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
npm run -w apps/cockpit test -- src/components/cockpit/gslr-static-evidence-workbench.test.tsx src/routes/engineering/gslr-evidence-workbench-route.test.tsx
npm run typecheck
```

Result:

- 2 focused Cockpit test files passed.
- 3 focused tests passed.
- Typecheck passed.

## Next Step

Proceed to `bead-1266`: static operator report export.

That follow-up should turn the current report text into an explicit exportable
artifact/report packet suitable for a bead or review note. It should remain
static and must not add persistence, live endpoints, production actions, or MC
connector/source-system access.
