# GSLR Current Progress: 2026-05-13

Status: post-GSLR-11 progress update  
Tracking bead: `bead-1253`

## Where We Are

We have moved from a routing theory into a small, test-backed engineering
evidence loop:

```text
prompt-language experiment evidence
  -> static Portarium evidence-card contract
  -> frozen Cockpit export model
  -> static Cockpit operator view
```

The loop is intentionally static. It proves that evidence can be shaped and
shown honestly before Portarium allows any runtime action.

## What We Have Learned

The useful architecture is mixed:

```text
Codex/frontier models -> planner, advisor, escalation lane, hard-work lane
Prompt Language       -> deterministic scaffolds, gates, policy tables, evidence shape
Local models          -> bounded hook filling inside those scaffolds
Portarium Cockpit     -> operator-visible boundary and governance surface
```

The strongest positive result remains GSLR-8: a PL-owned route-record compiler
passed three local repeats with zero frontier tokens because the local model only
filled small predicate hooks. The strongest negative result remains GSLR-7:
route-record construction failed when the local model still owned policy-table
invariants.

That tells us the system should not ask local models to own governance logic.
It should ask local models to fill narrow, reviewable pieces after Prompt
Language has removed the invariant risk.

## What Is Now Built

Portarium now has:

- a docs/test-only static engineering evidence-card input contract;
- a static GSLR projector for checked-in route evidence;
- a frozen Cockpit-facing export model;
- a static Cockpit route at `/engineering/evidence-cards/static`;
- checked-in static GSLR-8 and GSLR-7 evidence fixtures;
- tests proving the static view renders promoted and blocked evidence without
  action controls.

prompt-language now records GSLR-8 as the strongest local-screen result and
tracks GSLR-11 as a downstream Cockpit proof.

MacquarieCollege now records the same boundary: MC remains a reference vertical
only, with no connector observation, source-system reads or writes, raw payload
movement, runtime cards, or production action paths.

## What This Proves

GSLR-11 proves static operator legibility:

- positive local-screen evidence can be displayed without becoming operational;
- failed evidence can be displayed as `blocked` instead of disappearing;
- route, model, gates, cost, artifacts, and boundary warnings can fit a Cockpit
  operator surface;
- Cockpit can show the mixed frontier/PL/local-model decision boundary without
  live ingestion.

This is enough to continue toward a governed engineering cockpit. It is not
enough to create runtime automation.

## What Remains Blocked

Still blocked:

- live prompt-language manifest ingestion;
- signed-bundle import into production state;
- runtime Cockpit engineering cards;
- route-record queues;
- route-record database tables;
- SSE streams for GSLR evidence;
- automatic route decisions from GSLR manifests;
- production actions based on GSLR evidence;
- MC connector observation or raw school-data movement.

## Next Step

The next safe work item is a manual signed-bundle proof/design.

It should answer:

- what exactly is inside a GSLR evidence bundle;
- how the bundle is signed or otherwise authenticated;
- how Portarium parses it without trusting arbitrary payload fields;
- how Cockpit displays it as static evidence;
- how the bundle is kept separate from runtime action execution;
- what human review or approval is needed before any later move toward live
  ingestion.

Do this before building any live ingestion path.
