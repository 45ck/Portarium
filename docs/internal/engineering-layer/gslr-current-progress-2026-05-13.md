# GSLR Current Progress: 2026-05-13

Status: post-GSLR-12 progress update
Tracking beads: `bead-1253`, `bead-1254`

## Where We Are

We have moved from a routing theory into a small, test-backed engineering
evidence loop:

```text
prompt-language experiment evidence
  -> static Portarium evidence-card contract
  -> frozen Cockpit export model
  -> static Cockpit operator view
  -> signed/static evidence-bundle verification before projection
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
  action controls;
- a docs/test-only `GslrEvidenceBundleV1` verifier that checks provenance,
  payload hash, signature, validity window, artifact hashes, and static-only
  constraints before projecting evidence to an engineering card.

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

GSLR-12 proves static verifier legibility:

- externally shaped GSLR evidence can be authenticated before projection;
- tampering, invalid signatures, expired bundles, missing artifact hashes, raw
  payload fields, provenance mismatches, and runtime-authority claims are
  rejected;
- verified failed evidence still projects as `blocked`.

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

The next safe work item is GSLR-13: a manual Cockpit bundle preview.

It should:

- let an operator paste or load a GSLR evidence bundle fixture;
- run the GSLR-12 verifier locally in the static route;
- show hash/signature/provenance/expiry status;
- render the static evidence card only if verification passes;
- show rejected bundles as rejected evidence, not as runtime errors;
- keep persistence, queues, tables, SSE, and action controls absent.

Do this before building any live ingestion path.
