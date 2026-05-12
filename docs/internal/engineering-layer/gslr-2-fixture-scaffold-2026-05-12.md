# GSLR-2 Fixture Scaffold: 2026-05-12

Status: R&D scaffold record, not product integration  
Tracking bead: `bead-1231`  
Companion prompt-language bead: `prompt-language-gslr6`

## What Changed

Prompt-language now has the next governed local/frontier routing fixture:

- `experiments/harness-arena/fixtures/gslr2-policy-schema/`
- `experiments/harness-arena/oracles/gslr2-policy-schema-oracle.mjs`
- `experiments/harness-arena/live/gslr2-deterministic-lane.mjs`
- `experiments/harness-arena/GSLR-2-POLICY-SCHEMA-RUNBOOK.md`
- `experiments/harness-arena/results/gslr2-fake-live-2026-05-12/report.md`

The fixture is a tiny validator for an engineering action policy envelope. It
checks route class, work item identity, required gates, token-telemetry budget
requirements, final-verdict evidence, and recursive rejection of raw or secret
payload keys.

## Why Portarium Should Care

This is the first post-Symphony task shaped like a Portarium evidence boundary:

```text
Can a PL work item become a measurable implementation contract whose route,
gates, review defects, and cost telemetry Portarium could later govern?
```

That is more relevant than GSLR-1's docs projection because it exercises code,
schema, public tests, and hidden policy checks. It is still not Portarium product
evidence.

## Product Boundary

Do not build runtime ingestion or a Cockpit evidence card yet.

The current GSLR-2 result is only a deterministic fake-live proof. It passed
with `finalVerdict.status == "pass"`, private oracle pass, zero blocking review
defects, and parser-visible token telemetry on deterministic frontier-shaped
steps. It shows that the harness can copy the fixture, run a public gate, run a
private oracle, parse token telemetry, and produce a passing final verdict when
a deterministic lane writes the known-good solution.

Portarium work remains blocked until a live four-arm GSLR-2 run shows:

- public gate and private oracle pass;
- `finalVerdict.status == "pass"`;
- no unresolved blocking review defects;
- frontier token telemetry for every frontier step;
- matched-cost comparison that shows hybrid value over frontier-only.

Live update on 2026-05-12: the hardened GSLR-2 four-arm run has now completed.
All arms passed, but hybrid did not show matched-cost value. Local-only was the
best route for this exact tiny validator shape. See
[gslr-2-live-result-2026-05-12.md](./gslr-2-live-result-2026-05-12.md).

## What This Would Prove If Positive

A positive live GSLR-2 result would support a narrow claim:

```text
Prompt Language can turn a governed engineering bead into an executable,
reviewable, cost-measured contract, and local models can be used for bounded
implementation only when gates and frontier review preserve quality.
```

It would not prove broad local autonomy, production merge safety, or live
Portarium action-boundary governance.

## Next Step

Run the prompt-language GSLR-2 fixture with live local-only, frontier-only,
advisor-only, and hybrid-router arms. If the hybrid arm passes and beats the
matched frontier baseline, then Portarium can build a static evidence-card mock
from the manifest. If it fails, improve the route policy or fixture before
building product surfaces.

## Execution Record

2026-05-12:

- Created and claimed `bead-1231`.
- Recorded the GSLR-2 fixture scaffold and Portarium product boundary.
- Kept runtime ingestion and Cockpit evidence-card work blocked on positive live
  model evidence.
- Follow-up: GSLR-2 live evidence arrived, but it supports local-only screening
  for this task shape rather than hybrid product ingestion.
