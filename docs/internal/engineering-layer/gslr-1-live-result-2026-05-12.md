# GSLR-1 Live Result: Portarium Decision

Status: R&D result, not product integration  
Tracking bead: `bead-1228`  
Companion prompt-language bead: `prompt-language-gslr3`  
Prompt-language result:
`experiments/harness-arena/results/gslr1-live-2026-05-12/report.md`

## Decision

Do not build the Portarium static Cockpit evidence card yet.

The prompt-language GSLR-1 live run produced real harness evidence, but not the
positive hybrid-routing result needed to justify a product-facing Portarium card.

## What Happened

The live run used the sanitized MacquarieCollege projection fixture across local,
frontier, advisor, and hybrid arms.

Result summary:

| Arm             | Frontier steps | Local steps | Gate/oracle                         | Review           | Portarium interpretation                               |
| --------------- | -------------: | ----------: | ----------------------------------- | ---------------- | ------------------------------------------------------ |
| `local-only`    |              0 |           1 | pass                                | none             | Local can handle this bounded docs projection.         |
| `frontier-only` |              1 |           0 | pass                                | none             | Frontier baseline passed.                              |
| `advisor-only`  |              1 |           1 | pass after oracle calibration rerun | none             | Advisor control passed, but does not prove governance. |
| `hybrid-router` |              2 |           1 | pass                                | blocking finding | Not positive evidence.                                 |

The hybrid arm passed the private oracle, but the frontier review reported a
blocking defect about internal evaluation wording. Under the GSLR-1 verdict
rules, public/private gate pass plus blocking review defect is still a fail.

## What This Means For Portarium

The useful evidence is:

- prompt-language can now produce live route manifests for local/frontier lanes;
- local model output can be bounded by gates on a safe docs projection;
- private-oracle artifacts can stay outside the model-visible workspace;
- manifests are close to the evidence package Portarium would consume.

The blocking evidence is:

- the hybrid route used more frontier calls than the frontier-only control;
- the hybrid route was slower than both local-only and frontier-only;
- the GSLR-1 archived manifests did not yet fold review defects into a
  manifest-level final verdict;
- the GSLR-1 archived manifests did not yet parse token/cost telemetry into
  manifest cost fields.

Follow-up hardening for new prompt-language runs has now started under
companion bead `bead-1229` / `prompt-language-gslr4`: generated manifests now
include a top-level `finalVerdict`, blocking review defects fail that verdict,
and Codex-style `tokens used` summaries are promoted into step cost telemetry.
This improves the next evidence packet, but it does not retroactively make
GSLR-1 product-positive.

## Product Boundary

Portarium should not ingest these manifests as product evidence yet.

The next Portarium-visible milestone should wait for a revised run that has:

- manifest-level final verdict;
- parsed frontier token/cost telemetry;
- no unresolved blocking review defect;
- a task where hybrid routing has a credible chance to reduce cost/tokens;
- a positive hybrid result against local-only and frontier-only controls.

Until then, Portarium's role stays as governance target and evidence consumer,
not runtime integrator.

## Next Step

Prompt-language should run GSLR-2 before Portarium builds the card.

Recommended GSLR-2 shape:

- tiny schema/code change with tests, not a docs-only projection;
- local-only, frontier-only, advisor-only, and hybrid-router controls;
- final review defects counted directly in the manifest verdict;
- frontier token/cost extraction from Codex stderr;
- success metric based on verified cost/tokens if final frontier review is
  mandatory.

## Execution Record

2026-05-12:

- Created and claimed `bead-1228`.
- Recorded that GSLR-1 live evidence is real but not product-positive.
- Kept Portarium static evidence-card work blocked on a positive GSLR-2 or
  revised hybrid result.
- Closed `bead-1228` after the result docs were added and linked.
- Created and claimed `bead-1229` for the first post-GSLR-1 hardening step:
  manifest final verdict plus frontier token telemetry before GSLR-2.
