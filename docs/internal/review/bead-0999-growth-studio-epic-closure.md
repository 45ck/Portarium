# Growth Studio Epic Closure Review

Bead: `bead-0999`
Date: 2026-05-04

## Scope

This review closes the original Autonomous B2B Growth Studio showcase epic by
tying its success criteria to the committed Iteration 2 scenario contracts,
deterministic result bundle, opt-in live rerun coverage, and residual-risk
review.

The original epic asked for a live business loop:

```text
research -> plan -> create assets -> request approval -> execute -> measure -> iterate
```

The committed implementation evidence is now anchored on
`growth-studio-openclaw-live-v2`, which models the governed Growth Studio loop,
long-pending Approval Gates, exact resume after operator decisions, and
continuous Evidence Artifacts.

## Evidence Reviewed

| Criterion                                                 | Closure evidence                                                                                                                                                                                                       | Status |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| OpenClaw plus Portarium end-to-end in a business scenario | `experiments/iteration-2/scenarios/growth-studio-openclaw-live-v2/README.md` and `run.mjs` define the governed Growth Studio scenario with `live-wait` and `restart-resume` variants.                                  | Closed |
| Human approval gates for mutations                        | `experiments/iteration-2/results/growth-studio-openclaw-live-v2/deterministic-growth-v2/queue-metrics.json` records two `Assisted` and two `Human-approve` approvals across two sessions.                              | Closed |
| Exact resume after operator approval                      | `outcome.json` asserts four successful resumes, `duplicate_execution_count: 0`, and no replayed prior writes.                                                                                                          | Closed |
| Evidence chain captures the audit trail                   | `evidence-summary.json` is complete, and `outcome.json` records two four-entry hash-linked evidence chains covering before wait, during wait, approval decision, and after resume.                                     | Closed |
| Metrics dashboard or funnel data exists for reporting     | `queue-metrics.json` records queue depth over time, blocked durations, p95 pending age, resume latency samples, successful resumes, restart count, and duplicate execution count.                                      | Closed |
| Demo and pilot readiness can be assessed                  | `docs/internal/review/bead-1047-iteration-2-experiment-synthesis.md` synthesizes the Growth Studio result with the broader governed experiment suite and separates confirmed behavior from unproven assumptions.       | Closed |
| Live model/OpenClaw rerun path is guarded and redacted    | `scripts/integration/scenario-growth-studio-openclaw-live-v2.test.ts` covers the explicit live OpenClaw rerun gate, redacted provider metadata, approval IDs, evidence completeness, and exact-once resume comparison. | Closed |

## Confirmed Signals

- The deterministic Growth Studio attempt is `deterministic-growth-v2`.
- Both required variants complete: `live-wait` and `restart-resume`.
- Four approval-resume samples are represented.
- Pending approval p95 is `32,400,000 ms`, within the scenario threshold.
- Resume latency samples are all `1,500 ms`, within the scenario threshold.
- Duplicate execution count is `0`.
- Required Evidence Artifacts are complete: `outcome.json`,
  `queue-metrics.json`, `evidence-summary.json`, and `report.md`.

## Residual Risk

This closure does not claim autonomous production writes against real systems of
record. The Iteration 2 synthesis explicitly keeps those assumptions unproven:
hosted production persistence, real provider/SoR durability, full browser
operator QA, and broad live LLM variability remain outside this epic's closure.

The live OpenClaw path is intentionally opt-in. It is covered by test fixtures
that prove the rerun contract and redaction behavior without spending provider
quota in default CI. Real provider reruns should continue to write new attempt
directories under:

```text
experiments/iteration-2/results/growth-studio-openclaw-live-v2/<attempt-id>/
```

## Decision

Close `bead-0999` as the epic-level Growth Studio showcase closure. The
remaining production-like pilot and engineering-sandbox work belongs to later
pilot and sandbox Beads, not this showcase epic.
