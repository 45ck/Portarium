# Iteration 2 Experiment Synthesis and Residual Risk Review

Bead: `bead-1047`
Date: 2026-05-03

## Scope

This report synthesizes the Iteration 2 governed experiment suite defined in
`experiments/iteration-2/suite.manifest.json` and compares it with the
Iteration 1 OpenClaw governance findings in `examples/openclaw/findings.md` and
`examples/openclaw/results/timing-summary.json`.

The synthesis uses the deterministic result bundles generated for this review
under `experiments/iteration-2/results/`. These bundles are evidence for the
scenario contracts and telemetry paths. They are not evidence that live LLM,
hosted control-plane, PostgreSQL, OpenFGA, Cockpit, provider, or long-running
production infrastructure behavior has been exercised unless explicitly stated.

## Evidence Artifacts Reviewed

| Scenario                         | Bead        | Attempt                                 | Outcome      | Evidence Artifacts                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ----------- | --------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `growth-studio-openclaw-live-v2` | `bead-1042` | `deterministic-growth-v2`               | Confirmed    | `experiments/iteration-2/results/growth-studio-openclaw-live-v2/deterministic-growth-v2/outcome.json`, `queue-metrics.json`, `evidence-summary.json`, `report.md`                                                                                                                                    |
| `micro-saas-agent-stack-v2`      | `bead-1043` | `deterministic-handoff-v2`              | Confirmed    | `experiments/iteration-2/results/micro-saas-agent-stack-v2/deterministic-handoff-v2/outcome.json`, `queue-metrics.json`, `evidence-summary.json`, `demo-machine-preflight.json`, `report.md`                                                                                                         |
| `openclaw-concurrent-sessions`   | `bead-1044` | `deterministic-concurrency-v1`          | Confirmed    | `experiments/iteration-2/results/openclaw-concurrent-sessions/deterministic-concurrency-v1/outcome.json`, `queue-metrics.json`, `evidence-summary.json`, `report.md`                                                                                                                                 |
| `approval-backlog-soak`          | `bead-1045` | `deterministic-soak-v1`                 | Confirmed    | `experiments/iteration-2/results/approval-backlog-soak/deterministic-soak-v1/outcome.json`, `queue-metrics.json`, `evidence-summary.json`, `report.md`                                                                                                                                               |
| `micro-saas-toolchain-redo`      | `bead-1046` | `toolchain-realism-v1`                  | Inconclusive | `experiments/iteration-2/results/micro-saas-toolchain-redo/toolchain-realism-v1/outcome.json`                                                                                                                                                                                                        |
| `governed-resume-recovery`       | `bead-1059` | `deterministic-recovery`                | Confirmed    | `experiments/iteration-2/results/governed-resume-recovery/deterministic-recovery/outcome.json`, `queue-metrics.json`, `evidence-summary.json`, `plan-before-interruption.json`, `approval-before-interruption.json`, `cockpit-waiting-state.json`, `evidence-chain-after-recovery.json`, `report.md` |
| `shift-aware-approval-coverage`  | `bead-1069` | `deterministic-shift-coverage-v1`       | Confirmed    | `experiments/iteration-2/results/shift-aware-approval-coverage/deterministic-shift-coverage-v1/outcome.json`, `queue-metrics.json`, `evidence-summary.json`, `assignment-evidence.json`, `report.md`                                                                                                 |
| `execution-reservation-recovery` | `bead-1142` | `deterministic-reservation-recovery-v1` | Confirmed    | `experiments/iteration-2/results/execution-reservation-recovery/deterministic-reservation-recovery-v1/outcome.json`, `queue-metrics.json`, `evidence-summary.json`, `reservation-ledger-redacted.json`, `dispatch-attempts-redacted.json`, `recovery-decisions-redacted.json`, `report.md`           |

## Confirmed Behavior

Iteration 1 confirmed the basic runtime governance loop: tool-call interception,
approval lifecycle, operator denial, maker-checker enforcement, and one live
OpenClaw approval/resume path. Its local timing summary recorded 1-7 ms propose
RTT, 0 ms maker-checker enforcement latency, and an 8.025 second simulated
polling wait.

Iteration 2 expands the deterministic surface from single approval checks to
delayed queues, multiple sessions, handoff, recovery, reservation, and evidence
completeness:

| Metric across confirmed Iteration 2 runs |        Result |
| ---------------------------------------- | ------------: |
| Confirmed scenario attempts              |             7 |
| Governed approvals represented           |            50 |
| Successful resumes represented           |            33 |
| Duplicate execution count                |             0 |
| Evidence completeness count              |            37 |
| Missing required Evidence Artifacts      |             0 |
| Peak queue depth                         |            24 |
| Highest pending-age p95                  | 32,400,000 ms |
| Highest resume latency                   |      1,500 ms |
| Escalations represented                  |             5 |
| Expiries represented                     |             3 |

The most important improvement over Iteration 1 is exact-once behavior across
longer waits and recovery cases. `growth-studio-openclaw-live-v2` held approvals
for up to 32,400,000 ms with a 1,500 ms resume latency and zero duplicate
execution. `governed-resume-recovery` represented process crash, service restart,
deploy restart, and provider outage variants; the three approval-resume variants
resumed exactly once, while the provider outage was classified as an environment
limitation rather than a product success.

Queue behavior is now measured instead of inferred. `approval-backlog-soak`
represented 24 approvals, peak queue depth 24, p95 pending age 52,000 ms, four
escalations, three expiries, and zero duplicate escalation or execution events.
`openclaw-concurrent-sessions` represented four concurrent sessions resolved in
mixed order with session-scoped approvals, output bundles, Evidence Artifacts,
and zero cross-session unblock.

Operator handoff behavior also improved. `micro-saas-agent-stack-v2` represented
two operator roles, one denial, one request-changes decision, three approved
items, preserved Separation of Duties, and queue snapshots before and after
operator action. `shift-aware-approval-coverage` extended this by proving
bounded delegation windows, reassignment evidence, one after-hours escalation,
eligibility rejection for an ineligible delegated operator, and four successful
resumes without silently stalled work.

Execution reservation recovery closes a material gap left by Iteration 1:
approved Action execution is protected after approval, not only before approval.
`execution-reservation-recovery` represented active in-progress retry, completed
replay, fingerprint conflict fail-closed behavior, lost-claim release, and lost
completion recovery. All reservation-specific artifacts were redacted before
write and duplicate execution remained zero.

## Regressions and Newly Found Flaws

The realism-focused `micro-saas-toolchain-redo` did not complete because the
required `content-machine` CLI was not installed or not on `PATH`. This is a
useful fail-closed result for preflight behavior, but it means the Iteration 2
suite did not prove content-machine output generation, demo-machine runnable
post-validation, or real tool usage evidence for that scenario in this checkout.

Traceability for `growth-studio-openclaw-live-v2` is anchored on the
`deterministic-growth-v2` attempt directory. The directory, `outcome.json`,
`queue-metrics.json`, `evidence-summary.json`, and `report.md` now use that same
attempt id, preserving the synthesis references in the evidence table above.

Iteration 2 remains mostly deterministic replay. That is suitable for CI and
scientific comparison, but it is weaker than the Iteration 1 live OpenClaw run
for proving runtime integration with a real agent/model. The live behavior is
therefore improved in breadth of modeled cases but not yet improved in live
integration evidence.

## Inconclusive or Unproven Assumptions

The following must not be treated as confirmed by this report:

- Hosted production-like latency, persistence, failover, or multi-region
  behavior. The runs are deterministic local scenario executions.
- Live LLM decision variability, prompt-injection resistance beyond the existing
  Iteration 1 live and denial examples, or intent-level governance.
- Cockpit manual operator UX under real browser interaction. Some artifacts
  model Cockpit-visible state, but no browser QA was part of this review.
- PostgreSQL, OpenFGA, credential vaulting, provider APIs, and external SoR
  durability under load.
- Real content-machine or demo-machine execution for `micro-saas-toolchain-redo`.
- Production queue SLOs. The highest p95 pending age and resume latency are
  deterministic scenario values, not measured service-level indicators.

## Pilot Recommendation

The governed agent stack is ready for a constrained, production-like business
pilot only if the pilot is deliberately scoped to non-destructive or stubbed
external effects, explicit human approvals, instrumented queues, redacted
Evidence Artifacts, and rollback-free observation. It is not ready for autonomous
production writes against real SoRs.

The strongest confirmed signals are fail-closed approval gating, Separation of
Duties preservation, exact-once deterministic resume, queue/evidence telemetry,
after-hours coverage modeling, and execution reservation recovery. The strongest
remaining risks are live toolchain realism, production persistence, browser
operator workflow, and real provider/SoR integration.

## Follow-up Beads

Open follow-up work has been converted into root Beads, all blocked by
`bead-1047` so they become ready only after this synthesis lands:

| Bead        | Priority | Phase         | Title                                                                        |
| ----------- | -------- | ------------- | ---------------------------------------------------------------------------- |
| `bead-1144` | `P2`     | `integration` | Fix iteration 2 attempt-id traceability mismatch                             |
| `bead-1145` | `P1`     | `integration` | Run micro-saas-toolchain-redo with content-machine and demo-machine evidence |
| `bead-1146` | `P1`     | `integration` | Production-like pilot rehearsal for governed approval queues                 |
| `bead-1147` | `P2`     | `integration` | Live LLM rerun for Iteration 2 concurrency and delayed resume                |

These Beads carry the acceptance criteria for traceability repair, real
Machine/toolchain evidence, production-like Cockpit and durable-store rehearsal,
and opt-in live LLM/OpenClaw reruns.
