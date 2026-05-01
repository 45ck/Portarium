# Approval Evaluation Scenarios v1

## Scope

This spec defines the OSS-facing approval evaluation runbook and the scenario
artifacts that prove deterministic approval routing, execution reservation
safety, and optional live LLM approval-loop behavior.

The public runbook is `docs/how-to/run-approval-evaluations.md`.

## Deterministic Artifacts

The default eval path must not require live LLM keys, external SaaS credentials,
or hosted provider accounts.

Required deterministic artifacts:

| Artifact                                                                               | Required coverage                                                                                     |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `scripts/integration/scenario-core-governance-eval.test.ts`                            | policy routing, approval event stream, approval decision, governed resume                             |
| `scripts/integration/scenario-approval-execute-lifecycle.test.ts`                      | approve-then-execute, denied approval rejection, double-execute rejection                             |
| `scripts/integration/scenario-execution-reservation-recovery.test.ts`                  | active reservation retry, crash-after-dispatch retry, terminal replay, incompatible replay conflict   |
| `scripts/integration/scenario-policy-approval-routing-eval.test.ts`                    | tier policy matrix, approval routing, maker-checker approval and denial paths                         |
| `src/application/commands/execute-approved-agent-action.test.ts`                       | concurrent execute, active `Executing` reservation retry, crash-after-dispatch-before-finalize replay |
| `src/presentation/runtime/control-plane-handler.agent-action-execute.contract.test.ts` | HTTP execute contract and `Executing` response shape                                                  |
| `experiments/iteration-2/scenarios/governed-resume-recovery/run.mjs`                   | pending Approval Gate recovery and exactly-once governed resume result artifacts                      |
| `experiments/iteration-2/scenarios/execution-reservation-recovery/run.mjs`             | execution reservation recovery result artifacts and redaction audit                                   |

The Iteration 2 recovery runner writes append-only artifacts under:

```text
experiments/iteration-2/results/governed-resume-recovery/<attempt-id>/
```

Required files are `outcome.json`, `evidence-summary.json`,
`queue-metrics.json`, and `report.md`.

The execution reservation recovery runner must additionally write
`reservation-ledger-redacted.json`, `dispatch-attempts-redacted.json`, and
`recovery-decisions-redacted.json`. Those artifacts must be checked for
synthetic forbidden fragments before the scenario can report `confirmed`.

## Live LLM Boundary

Live LLM approval evaluations are optional and disabled by default. They are
valid only when the runner uses `experiments/shared/experiment-runner.js` with
`liveModelPreflight: true` or equivalent behavior from
`live-model-experiment-preflight-v1`.

Live evaluations must:

1. Require `PORTARIUM_EXPERIMENT_LIVE_LLM=true` or
   `PORTARIUM_LIVE_MODEL_RUNS=true` before provider calls.
2. Skip before setup or execution when credentials are missing.
3. Mark provider rejection, quota, unavailable model, network, or unexpected
   provider responses as inconclusive.
4. Record provider, model, probe kind, HTTP status, failure kind, and redacted
   run metadata only. Public result bundles must not record credential env var
   names, base URLs, CLI auth details, or expected credential source lists.
5. Never store credential values, secret-bearing prompts, customer data, or
   proprietary source text in result bundles, traces, reports, screenshots, or
   logs.
6. Demonstrate both approval and reject behavior before being used as release
   evidence for a live approval loop.

## Safety Invariants

1. CI remains deterministic and must not perform live provider calls.
2. Approval evaluations sign off on a Plan and approval decision trail, not raw
   model output.
3. Execution reservation recovery is proven by deterministic tests, not by
   injecting failures into shared provider accounts.
4. Concurrent execute, active `Executing` retry, and crash-after-dispatch
   scenarios must show no duplicate dispatch, event publish, evidence append, or
   approval state overwrite.
5. Any new evaluation artifact that changes behavior must update this spec and
   the public runbook in the same change.
