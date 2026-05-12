# GSLR Progress Checkpoint: 2026-05-13

Status: post-GSLR-10 progress checkpoint  
Tracking bead: `bead-1251`

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

GSLR-9 and GSLR-10 moved the result toward Portarium:

- GSLR route evidence can become a docs/test-only
  `EngineeringEvidenceCardInputV1`;
- validated cards can become frozen Cockpit-facing view models with route,
  model, gate, cost, artifact-ref, and boundary-warning fields;
- failed evidence stays visible as `blocked` instead of disappearing.

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
- live Cockpit engineering cards;
- Cockpit routes backed by GSLR runtime data;
- route-record queues;
- route-record database tables;
- runtime decisions from GSLR manifests;
- MC connector observation or school-data movement;
- production action paths based on GSLR evidence.

The reason is simple: GSLR-10 proves static operator legibility, not runtime
trust.

## Next Product-Safe Step

The next step should be GSLR-11: a static Cockpit fixture/view proof.

That means:

- use checked-in static GSLR-8 and GSLR-7 card/export fixtures only;
- render or snapshot the operator-facing shape without runtime ingestion;
- verify the view makes `research-only`, `blocked`, route, model, gate, cost,
  artifacts, and warnings obvious;
- keep all action controls disabled or absent.

This would prove whether the Cockpit surface communicates the evidence honestly.
Only after that should we consider manual import, signed bundles, or live
ingestion design.

## Progress Record

2026-05-13:

- Portarium reached GSLR-10 with static Cockpit export support.
- prompt-language recorded GSLR-8 as the strongest positive local-screen result
  so far.
- MacquarieCollege remains a reference vertical and boundary test only.
- The next real question is human/operator comprehension, not more routing
  automation.
