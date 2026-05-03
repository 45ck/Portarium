# Governed Pilot Usefulness Scorecard v1

## Scope

This specification defines the scorecard used to decide whether a controlled
Portarium operator pilot is useful compared with the current way of working.
It applies to Growth Studio, the micro-SaaS proving workflow, and the first real
operator pilot. It does not define Cockpit UI implementation, billing systems,
or customer-specific business targets.

The scorecard extends the pilot readiness sequence in
[docs/internal/governance/pilot-readiness-sequence.md](../../docs/internal/governance/pilot-readiness-sequence.md)
and the governed experiment metric contract in
[iteration-2-governed-experiment-suite-v1.md](./iteration-2-governed-experiment-suite-v1.md).

## Decision Rule

A pilot is useful only when the final pilot report can answer this question:

> Did Portarium's governed stack beat the current way of working for the chosen
> business workflow without hiding safety, quality, cost, or operator-load
> regressions?

The answer must be one of:

| Rating  | Meaning                                                                  |
| ------- | ------------------------------------------------------------------------ |
| Success | Efficiency or business KPI gains are material and no guardrail fails.    |
| Concern | Some gains exist, but one or more guardrails or adoption signals weaken. |
| Failure | The governed stack is slower, less safe, less useful, or inconclusive.   |

Demo-only correctness, successful approvals, or interesting agent output are
not sufficient. The report must compare governed operation with a pre-pilot
baseline collected from the same workflow.

## Shared Metric Names

These metric names are stable across Growth Studio, micro-SaaS, and the first
real pilot. Scenario-specific reports may add detail, but they must not rename
these fields.

| Metric name                        | Unit                 | Definition                                                                                   |
| ---------------------------------- | -------------------- | -------------------------------------------------------------------------------------------- |
| `operator_minutes_per_run`         | minutes per Run      | Active human time spent starting, steering, reviewing, approving, fixing, and closing a Run. |
| `approval_latency_ms_p50`          | milliseconds         | Median elapsed time from Approval Gate creation to decision.                                 |
| `approval_latency_ms_p95`          | milliseconds         | p95 elapsed time from Approval Gate creation to decision.                                    |
| `blocked_duration_ms_p50`          | milliseconds         | Median time a Run is unable to progress because it is waiting on governance or coverage.     |
| `blocked_duration_ms_p95`          | milliseconds         | p95 time a Run is unable to progress because it is waiting on governance or coverage.        |
| `throughput_per_operator_per_day`  | useful outcomes/day  | Useful outcomes completed per assigned operator per working day.                             |
| `throughput_per_workspace_per_day` | useful outcomes/day  | Useful outcomes completed per Workspace per working day.                                     |
| `denial_rate`                      | ratio                | Denied Approval Gates divided by all decided Approval Gates.                                 |
| `rework_rate`                      | ratio                | Runs needing request-changes, correction, rollback, or repeat human work divided by Runs.    |
| `duplicate_execution_rate`         | ratio                | Duplicate externally-effectful Actions divided by all externally-effectful Actions.          |
| `unsafe_action_escape_rate`        | ratio                | Unsafe or policy-violating Actions that escaped prevention divided by governed Actions.      |
| `policy_violation_escape_rate`     | ratio                | Policy violations detected after execution divided by governed Actions.                      |
| `cost_per_useful_outcome`          | currency/outcome     | Model, tool, infrastructure, and operator cost divided by useful outcomes.                   |
| `model_cost_per_useful_outcome`    | currency/outcome     | LLM or provider inference cost divided by useful outcomes.                                   |
| `tool_cost_per_useful_outcome`     | currency/outcome     | Machine, connector, SaaS, compute, or external tool cost divided by useful outcomes.         |
| `operator_cost_per_useful_outcome` | currency/outcome     | Loaded operator minutes cost divided by useful outcomes.                                     |
| `business_kpi_delta_primary`       | percent or raw delta | Change in the workflow's primary business KPI against baseline.                              |
| `business_kpi_delta_secondary`     | percent or raw delta | Change in an agreed supporting business KPI against baseline.                                |
| `useful_outcome_count`             | count                | Completed outcomes accepted by the workflow owner as useful.                                 |
| `baseline_comparison_confidence`   | enum                 | `high`, `medium`, or `low` confidence in comparability of pilot and baseline windows.        |
| `baseline_sample_size_runs`        | count                | Number of baseline Runs or equivalent manual work items observed.                            |
| `pilot_sample_size_runs`           | count                | Number of governed pilot Runs observed.                                                      |

Iteration 2 queue metrics remain valid lower-level telemetry. Pilot reports
must map `pending_age_ms_p50`, `pending_age_ms_p95`, `blocked_duration_ms`,
`denial_count`, `request_changes_count`, and `duplicate_execution_count` into
the scorecard fields above.

## Useful Outcome

Each pilot must define a useful outcome before baseline capture starts.

| Workflow                    | Useful outcome example                                                                                   | Primary KPI example                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Growth Studio               | A governed campaign research, draft, approval, and publish/send-ready bundle accepted by the owner.      | Qualified campaign assets accepted per week or lead-ready outputs.  |
| micro-SaaS proving workflow | A governed source-to-micro-SaaS Artifact or backlog/QA/release package accepted for builder use.         | Accepted software Artifact packages per week.                       |
| First real operator pilot   | The chosen customer workflow's completed business item, accepted by the process owner after audit check. | Customer-selected KPI such as cycle time, cases closed, or revenue. |

Outcomes that are generated but rejected, duplicated, unsafe, policy-violating,
or lacking required Evidence Artifacts do not count as useful outcomes.

## Pre-Pilot Baseline Capture

Before the pilot starts, the owner must capture a baseline for the same workflow
without Portarium-governed execution.

### B1 Workflow selection

Record:

- workflow name and `projectTypeId`
- Workspace and process owner
- included Action classes and excluded Action classes
- current tools and SoRs used
- current human roles and handoff points
- primary and secondary business KPIs
- useful outcome definition
- baseline window dates and expected pilot window dates

### B2 Baseline sample

Collect at least one of these before starting the governed pilot:

| Confidence | Minimum baseline sample                                                                   |
| ---------- | ----------------------------------------------------------------------------------------- |
| High       | 30 or more comparable work items across at least 10 working days.                         |
| Medium     | 10-29 comparable work items across at least 5 working days.                               |
| Low        | Fewer than 10 comparable work items, synthetic replay only, or materially different work. |

The final report may not claim success with `baseline_comparison_confidence:
low`. Low confidence can support only `Concern` or `Failure`.

### B3 Baseline measurements

For each baseline item, capture:

- elapsed cycle time from intake to accepted outcome
- active operator minutes, including review and rework
- wait time caused by approval, handoff, missing access, or queue backlog
- throughput per operator and per Workspace
- denial, rejection, rework, and duplicated-work events
- escaped safety, compliance, or policy-equivalent defects
- cost components: operator cost, tool cost, and model/provider cost if any
- primary and secondary business KPI values
- evidence sufficiency for reconstructing the work

If direct instrumentation is unavailable, use time studies, calendar/chat
timestamps, ticket histories, SoR audit logs, or operator diaries. The source
and estimation method must be recorded per metric.

### B4 Pilot matching

The pilot window must match the baseline as closely as possible:

- similar workflow scope and Action classes
- similar volume, complexity, and customer/work item mix
- same useful outcome acceptance standard
- same business KPI definitions
- same loaded operator-cost assumptions
- explicit notes for holidays, launches, incidents, staffing changes, or tool
  migrations

## Thresholds

### Overall rating thresholds

| Rating  | Required scorecard result                                                                                                                                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Success | At least 20 percent lower `operator_minutes_per_run` or 20 percent higher `throughput_per_operator_per_day`; `business_kpi_delta_primary` is neutral or positive; all guardrail metrics are Success; confidence is High or Medium. |
| Concern | Efficiency gain is 5-19 percent, or primary KPI is neutral with weak secondary evidence, or one non-safety guardrail is Concern; confidence is not Low.                                                                            |
| Failure | Efficiency gain is below 5 percent, primary KPI regresses more than 5 percent, any safety guardrail fails, duplicate execution is above threshold, cost worsens without KPI gain, or confidence is Low.                            |

### Metric thresholds

| Metric group                    | Success                                                                   | Concern                                                                 | Failure                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Operator minutes per Run        | 20 percent or more reduction vs baseline.                                 | 5-19 percent reduction vs baseline.                                     | Less than 5 percent reduction or any increase without approved KPI tradeoff.            |
| Approval latency                | p95 within the pilot SLO and no material baseline cycle-time regression.  | p95 exceeds SLO by up to 25 percent or causes isolated avoidable waits. | p95 exceeds SLO by more than 25 percent or repeatedly stalls useful outcomes.           |
| Blocked duration                | p95 reduced vs baseline or within pilot SLO.                              | p95 flat or up to 15 percent worse with clear remediation.              | p95 more than 15 percent worse or any unresolved blocked Run past stop-loss threshold.  |
| Throughput per operator         | 20 percent or more increase vs baseline.                                  | 5-19 percent increase vs baseline.                                      | Less than 5 percent increase or decrease.                                               |
| Throughput per Workspace        | 15 percent or more increase vs baseline.                                  | Flat to 14 percent increase with quality gains.                         | Decrease without offsetting quality or business KPI gain.                               |
| Denial and request-changes rate | Stable or improved after controlling for stricter Policy.                 | Up to 50 percent relative increase with useful defect discovery.        | More than 50 percent relative increase caused by poor Plans, prompts, or evidence.      |
| Rework rate                     | 20 percent or more reduction vs baseline.                                 | Flat to 19 percent reduction.                                           | Increase above baseline.                                                                |
| Duplicate execution rate        | 0.                                                                        | 0, with near-miss remediation required.                                 | Greater than 0 duplicate externally-effectful Actions.                                  |
| Unsafe-action escape rate       | 0.                                                                        | 0, with near misses captured in Evidence and routed to Policy review.   | Greater than 0 unsafe Actions escape prevention.                                        |
| Policy-violation escape rate    | 0.                                                                        | 0, with near misses captured in Evidence and routed to Policy review.   | Greater than 0 policy-violating Actions escape prevention.                              |
| Cost per useful outcome         | 10 percent or more lower vs baseline, or equal with primary KPI gain.     | Up to 15 percent higher with clear KPI or safety gain.                  | More than 15 percent higher without KPI gain, or any unbounded provider/tool cost risk. |
| Business KPI delta              | Primary KPI improves or is neutral with strong secondary KPI improvement. | Primary KPI neutral and secondary KPI mixed.                            | Primary KPI regresses more than 5 percent or owner rejects outcome usefulness.          |
| Baseline comparison confidence  | `high`.                                                                   | `medium`.                                                               | `low`.                                                                                  |

Safety guardrails are veto metrics: duplicate execution, unsafe-action escapes,
and policy-violation escapes must remain zero for any Success rating.

## Cost Model

`cost_per_useful_outcome` must include:

- model/provider inference spend, including retries and failed attempts
- tool, connector, Machine, compute, and third-party SaaS spend attributable to
  the Run
- loaded operator cost for active minutes and required audit or verification
  sampling
- rework cost for denied, request-changes, corrected, or repeated work

Cost may exclude fixed platform engineering cost for early internal pilots, but
the exclusion must be explicit. Customer pilots must use customer-approved
loaded operator-cost assumptions.

## Report Requirements

The final pilot report must include:

- baseline workflow definition and sample size
- pilot workflow definition and sample size
- the shared metric table with baseline value, pilot value, delta, threshold,
  rating, and data source
- narrative explanation for every Concern or Failure metric
- guardrail veto result for duplicate execution, unsafe-action escapes, and
  policy-violation escapes
- cost model assumptions and exclusions
- business KPI deltas and owner acceptance
- final Success, Concern, or Failure rating
- follow-up Beads for any remediation required before broader rollout

## Acceptance

- A pre-pilot baseline capture plan exists for the chosen business workflow.
- The same metric names apply to Growth Studio, micro-SaaS, and the first real
  pilot.
- Operator minutes per Run, approval latency, blocked duration, throughput,
  denial, rework, duplicate execution, unsafe-action escape, policy-violation
  escape, cost, and business KPI deltas are defined.
- Thresholds for Success, Concern, and Failure are explicit.
- The final pilot report can say whether the governed stack beat the current
  way of working.
