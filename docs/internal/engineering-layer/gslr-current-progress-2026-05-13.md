# GSLR Current Progress: 2026-05-13

Status: post-GSLR-15 progress update
Tracking beads: `bead-1253`, `bead-1254`, `bead-1255`, `bead-1256`, `bead-1257`, `bead-1258`

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
  -> adversarial static bundle rejection corpus
  -> static import readiness design gate
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
  status, and renders the static evidence card only after verification passes;
- a checked-in adversarial static bundle corpus that covers expired,
  not-yet-valid, payload-hash-tampered, invalid-signature, missing-artifact,
  raw-payload, provenance-mismatch, runtime-authority, and action-controls
  rejection cases through the same preview path;
- a test-backed static import readiness gate that blocks import work unless a
  design defines production keyring trust, artifact byte verification,
  append-only static storage, no runtime authority, no action controls,
  operator review states, and structured verifier rejection codes.

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

GSLR-14 proves static rejection legibility:

- every adversarial bundle case is rejected;
- rejected bundles do not render static evidence cards;
- rejected cases identify the failed check row instead of collapsing into an
  opaque runtime error;
- the route still avoids live engineering endpoints while exercising the
  rejection path.

GSLR-15 proves static import readiness can be judged before import exists:

- the current manual preview shape is explicitly blocked from persistent import;
- a future static import design must replace test signatures with production
  keyring trust;
- a future design must verify artifact bytes instead of only declared refs;
- imported evidence needs append-only static storage and operator review states;
- structured rejection codes are required before import UI or storage depends on
  verifier failures;
- any plan with runtime authority, action controls, or live endpoints remains
  blocked.

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
- persistent signed-bundle import until a separate implementation bead satisfies
  the GSLR-15 readiness gate.

## Next Step

The next safe work item is GSLR-16: structured rejection codes and portable
static fixture corpus.

It should:

- add structured verifier rejection categories/codes;
- remove the preview's dependency on regex mapping over verifier error text;
- decide whether the adversarial corpus should be materialized as standalone
  `.bundle.json` files for importer-level tests;
- remain static/test-only with no persistent import, queues, tables, SSE,
  runtime cards, production actions, or MC connector/data movement.

Do this before building any live ingestion path.
