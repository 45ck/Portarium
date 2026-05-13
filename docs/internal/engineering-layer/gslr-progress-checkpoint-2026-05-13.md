# GSLR Progress Checkpoint: 2026-05-13

Status: post-GSLR-17 progress checkpoint
Tracking beads: `bead-1251`, `bead-1252`, `bead-1253`, `bead-1254`, `bead-1257`, `bead-1258`, `bead-1259`, `bead-1260`

## Short Version

The current evidence supports this architecture:

```text
Codex/frontier models -> plan, advise, diagnose, and handle hard or ambiguous work
Prompt Language       -> owns deterministic scaffolds, policy tables, gates, and evidence shape
Local models          -> fill bounded hooks when the scaffold removes invariant risk
Portarium Cockpit     -> displays governed evidence before any runtime action is allowed
```

This is no longer only a theory. The useful result is not "local models replace
frontier models." The useful result is that local models become reliable and
cheap when Prompt Language narrows their job and Portarium preserves the
evidence boundary.

## What We Have Proved

GSLR-1 through GSLR-5 showed the limits:

- local-only can pass tiny sanitized schema work;
- broader evidence-card transforms and validators route to frontier-baseline;
- privacy-sensitive raw-payload sanitization cannot be trusted to local prompts
  alone;
- one repaired local pass is not enough for promotion;
- repeat failures matter more than a single success.

GSLR-6 through GSLR-8 found the useful pattern:

- a scaffolded sanitizer passed three local repeats with zero frontier tokens;
- a route-record builder failed when the local model still owned policy-table
  invariants;
- a PL-owned route-record compiler passed three local repeats when the local
  model only filled generic predicate hooks.

GSLR-9 through GSLR-17 moved the result toward Portarium:

- GSLR route evidence can become a docs/test-only
  `EngineeringEvidenceCardInputV1`;
- validated cards can become frozen Cockpit-facing view models with route,
  model, gate, cost, artifact-ref, and boundary-warning fields;
- Cockpit can render checked-in static GSLR-8 and GSLR-7 evidence fixtures at
  `/engineering/evidence-cards/static`;
- static GSLR evidence bundles can verify payload hash, signature, provenance,
  artifact hashes, validity window, and static-only constraints before
  projection;
- failed evidence stays visible as `blocked` instead of disappearing;
- manual Cockpit preview can verify static bundle JSON before rendering a card;
- adversarial static bundles reject with targeted check rows and no live
  engineering endpoint calls;
- static import readiness is now captured as a test-backed gate, requiring
  production keyring trust, artifact byte verification, append-only static
  storage, operator review states, and structured rejection codes before any
  persistent import implementation;
- verifier rejection reasons now have stable machine-readable code/category
  fields, and the adversarial corpus is materialized as portable `.bundle.json`
  files for future importer-level tests;
- static imported-record shape now exists for verified and rejected bundles,
  preserving signer trust, artifact byte-verification status, operator review
  state, rejection code/category, and fixed no-runtime authority.

## Current Conclusion

The strongest conclusion is:

```text
Use local models for bounded hook-filling inside PL-owned scaffolds.
Use frontier/Codex for planning, escalation, first-failure diagnosis, and
ambiguous or privacy-sensitive work.
Use Portarium to make the route decision and evidence legible before anything
becomes operational.
```

This is exciting because it points to a practical engineering system, not just a
model benchmark. It gives us a way to spend frontier tokens where they matter
and use local compute where the risk has been structurally removed.

## What Is Still Blocked

Do not build these yet:

- live prompt-language manifest ingestion;
- persistent signed-bundle import;
- live Cockpit engineering cards;
- Cockpit routes backed by GSLR runtime data;
- route-record queues;
- route-record database tables;
- runtime decisions from GSLR manifests;
- MC connector observation or school-data movement;
- production action paths based on GSLR evidence.

The reason is simple: GSLR-12 proves static bundle verification, GSLR-14 proves
static rejection behavior, GSLR-15 proves the import-readiness gate, and
GSLR-16 proves structured rejection portability. GSLR-17 defines a static record
shape. None of those creates production trust or runtime authority.

## Next Product-Safe Step

GSLR-11 completed the static Cockpit fixture/view proof. GSLR-12 completed the
static signed-bundle verifier proof. GSLR-13 completed the manual Cockpit bundle
preview. GSLR-14 completed the adversarial static rejection corpus.
GSLR-15 completed the static import readiness design gate.
GSLR-16 completed structured rejection codes and portable adversarial files.
GSLR-17 completed the static imported-record contract.

It now:

- uses checked-in static GSLR-8 and GSLR-7 card/export fixtures only;
- renders the operator-facing shape without runtime ingestion;
- verifies the view makes `research-only`, `blocked`, route, model, gate, cost,
  artifacts, and warnings obvious;
- keeps all action controls absent.
- verifies static GSLR evidence bundles before projection and rejects tampering,
  invalid signatures, expired bundles, missing artifact hashes, raw payloads,
  provenance mismatches, and runtime-authority claims.
- rejects the GSLR-14 adversarial corpus in the manual preview without rendering
  static cards or calling live engineering endpoints.
- blocks the current manual preview shape from persistent import until
  production keyring trust, artifact byte verification, append-only static
  storage, operator review states, and structured verifier rejection codes are
  designed.
- maps preview rejection rows from verifier categories instead of regex over
  error messages.
- stores the adversarial corpus as standalone `.bundle.json` files plus a
  manifest with expected rejection code/category.
- defines accepted and quarantined static imported records without adding a
  repository, database table, queue, SSE stream, runtime card, or action path.

The next safe step is GSLR-18: static imported-record repository design. That
should define an append-only repository interface, idempotency key, duplicate
handling, review-state transitions, and audit/event boundaries without wiring
live PL ingestion, runtime cards, queues, tables, SSE, production actions, or MC
connector/data movement.

## Progress Record

2026-05-13:

- Portarium reached GSLR-10 with static Cockpit export support.
- Portarium reached GSLR-11 with a static Cockpit route/view for GSLR evidence
  fixtures.
- Portarium added a current progress update that separates the proven static
  evidence loop from the still-blocked runtime ingestion path.
- Portarium reached GSLR-12 with a docs/test-only signed GSLR evidence-bundle
  verifier.
- Portarium reached GSLR-13 with a manual Cockpit bundle preview.
- Portarium reached GSLR-14 with an adversarial static bundle rejection corpus.
- Portarium reached GSLR-15 with a static import readiness design gate.
- Portarium reached GSLR-16 with structured verifier rejection codes and a
  portable adversarial bundle corpus.
- Portarium reached GSLR-17 with a static imported-record contract.
- prompt-language recorded GSLR-8 as the strongest positive local-screen result
  so far.
- MacquarieCollege remains a reference vertical and boundary test only.
- The next real work item is static imported-record repository design, not more
  routing automation or live ingestion.
