# GSLR Current Progress: 2026-05-13

Status: post-GSLR-13 progress update
Tracking beads: `bead-1253`, `bead-1254`, `bead-1255`, `bead-1256`

## Where We Are

We have moved from a routing theory into a small, test-backed engineering
evidence loop:

```text
prompt-language experiment evidence
  -> static Portarium evidence-card contract
  -> frozen Cockpit export model
  -> static Cockpit operator view
  -> signed/static evidence-bundle verification before projection
  -> checked-in prompt-language bundle fixtures verified across the repo boundary
  -> manual Cockpit bundle preview before any runtime import
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
  constraints before projecting evidence to an engineering card;
- a sibling-repo compatibility test that verifies the prompt-language GSLR-8 and
  GSLR-7 static bundle fixtures when that checkout is present;
- an internal manual Cockpit preview at
  `/engineering/evidence-cards/bundle-preview` that loads or accepts pasted
  bundle JSON, verifies it with an explicit `nowIso`, shows the verification
  status, and renders the static evidence card only after verification passes.

prompt-language now records GSLR-8 as the strongest local-screen result and
publishes checked-in static bundle fixtures for GSLR-8 and GSLR-7.

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

GSLR-12.5 proves the handoff shape:

- prompt-language can produce static bundles that satisfy Portarium's verifier;
- artifact refs can be hash-checked against prompt-language files;
- verifier calls must pass an explicit `nowIso`;
- the cross-repo boundary remains manual/static only.

GSLR-13 proves static manual preview legibility:

- Cockpit can expose bundle verification as an operator-visible manual check;
- GSLR-8 positive evidence and GSLR-7 blocked evidence can both pass through the
  same bundle preview without creating runtime authority;
- tampered or malformed bundles become rejected evidence, not runtime errors;
- the route does not request live run, evidence, work-item, human-task, or
  workforce queue endpoints.

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

The next safe work item is GSLR-14: an adversarial static bundle corpus and
review checklist.

It should:

- add checked-in rejected bundles for expiry, not-yet-valid windows, payload hash
  tampering, invalid signatures, missing artifact hashes, provenance mismatches,
  raw payload keys, and runtime-authority claims;
- run those examples through the same verifier and manual preview tests;
- record an operator review checklist for deciding whether the next step is
  still static import design or broader verifier hardening.

Do this before building any live ingestion path.
