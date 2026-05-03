# Iteration 2 Governed Experiment Suite v1

## Scope

The Iteration 2 suite defines how Portarium validates longer-running governed
agent work after the initial live OpenClaw loop. It covers experiment planning,
versioning, metric names, and result evidence. It does not claim the live runs
have completed.

## Requirements

1. Iteration 1 experiment directories and result bundles are immutable.
2. Iteration 2 has a suite manifest at
   `experiments/iteration-2/suite.manifest.json`.
3. Every planned Iteration 2 scenario has a stable `scenarioId`, owner Bead, and
   scenario contract document.
4. Every rerun writes to a new attempt directory under
   `experiments/iteration-2/results/<scenario-id>/<attempt-id>/`.
5. Attempts must not overwrite previous results.
6. Live LLM or provider-backed runs must use the live model preflight from
   `live-model-experiment-preflight-v1`.
7. Every completed scenario report must reference queue, timing, resume,
   duplicate-execution, and evidence-completeness metrics by the manifest names.
8. The shared telemetry helper must write `queue-metrics.json`,
   `evidence-summary.json`, and `report.md` for each attempt.
9. Threshold checks must produce explicit pass/fail assertions that can be used
   by experiment `verify` steps.
10. Planned scenarios remain marked `planned` until their owner Beads add runnable
    experiment scripts and result reports.
11. Approval evaluation scenario artifacts and safety boundaries are governed by
    `approval-evaluation-scenarios-v1`. Iteration 2 approval recovery scenarios
    must remain append-only and deterministic unless explicitly routed through
    the live model preflight.

## Telemetry Helper

The reusable helper lives at `experiments/shared/iteration2-telemetry.js` with
TypeScript definitions in `experiments/shared/iteration2-telemetry.ts`.

It records:

- approval requested and decided events
- queue depth samples
- blocked session durations
- resume latency after approval decisions
- duplicate execution keys
- evidence artifact presence
- restart and successful resume counts

## Required Scenario Set

| Scenario                           | Owner Bead  | Purpose                                                       |
| ---------------------------------- | ----------- | ------------------------------------------------------------- |
| `growth-studio-openclaw-live-v2`   | `bead-1042` | delayed approval and exact resume                             |
| `micro-saas-agent-stack-v2`        | `bead-1043` | team handoff and out-of-order decisions                       |
| `openclaw-concurrent-sessions`     | `bead-1044` | concurrent governed sessions                                  |
| `approval-backlog-soak`            | `bead-1045` | backlog pressure, escalation, and expiry                      |
| `source-to-artifact-citation-loop` | `bead-1103` | cited source-to-dossier-to-Artifact loop                      |
| `governed-resume-recovery`         | `bead-1059` | pending approval recovery and resume                          |
| `shift-aware-approval-coverage`    | `bead-1069` | delegation windows, shift handoff, and after-hours escalation |
| `production-like-pilot-rehearsal`  | `bead-1146` | production-like approval queue pilot rehearsal                |

The `governed-resume-recovery` scenario is also a required approval evaluation
artifact under `approval-evaluation-scenarios-v1`; it anchors the public
runbook's append-only result bundle expectations for pending Approval Gate
recovery.

The `shift-aware-approval-coverage` scenario extends the operator-team handoff
baseline by proving that inactive primary operators do not silently stall
governed work, delegation windows and assignment changes are recorded as
evidence, eligibility and Separation of Duties remain enforced after handoff,
and the report compares after-hours behavior against
`micro-saas-agent-stack-v2`.

The `source-to-artifact-citation-loop` scenario proves that the same bounded
Source Snapshot set can produce a cited Research Dossier plus both content and
micro-SaaS downstream Artifacts. It must preserve claim IDs, Source Snapshot
IDs, confidence context, freshness, and claim boundaries in the downstream
Artifacts, and it must show operator taste, scope, and evidence-quality
interventions without collapsing the whole Run into manual work.

The `production-like-pilot-rehearsal` scenario combines the confirmed Iteration 2
approval, handoff, backlog, shift coverage, resume, and reservation scenarios
into a controlled-pilot rehearsal. It must capture queue SLOs, restart
persistence, browser QA evidence boundaries, redaction checks, divergence
classification, and Cockpit operator-flow verification paths while explicitly
stubbing external System of Record effects.

## Required Metric Names

- `approval_count_by_tier`
- `approval_count_by_session`
- `pending_age_ms_p50`
- `pending_age_ms_p95`
- `pending_age_ms_max`
- `resume_latency_ms`
- `blocked_duration_ms`
- `queue_depth_over_time`
- `denial_count`
- `request_changes_count`
- `escalation_count`
- `expiry_count`
- `duplicate_execution_count`
- `evidence_completeness_count`
- `restart_count`
- `successful_resume_count`

The pilot usefulness scorecard in
[governed-pilot-usefulness-scorecard-v1.md](./governed-pilot-usefulness-scorecard-v1.md)
adds the cross-workflow comparison metrics used by Growth Studio, micro-SaaS,
and the first real operator pilot:

- `operator_minutes_per_run`
- `approval_latency_ms_p50`
- `approval_latency_ms_p95`
- `blocked_duration_ms_p50`
- `blocked_duration_ms_p95`
- `throughput_per_operator_per_day`
- `throughput_per_workspace_per_day`
- `denial_rate`
- `rework_rate`
- `duplicate_execution_rate`
- `unsafe_action_escape_rate`
- `policy_violation_escape_rate`
- `cost_per_useful_outcome`
- `model_cost_per_useful_outcome`
- `tool_cost_per_useful_outcome`
- `operator_cost_per_useful_outcome`
- `business_kpi_delta_primary`
- `business_kpi_delta_secondary`
- `useful_outcome_count`
- `baseline_comparison_confidence`
- `baseline_sample_size_runs`
- `pilot_sample_size_runs`
