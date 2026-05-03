# Pilot Readiness Gate And Real-World Usefulness Decision

**Bead:** `bead-1067`
**Decision date:** 2026-05-03
**Decision:** Continue contained pilot
**Broader business-use recommendation:** No-go until the follow-up Beads below are closed with evidence.

## Executive Decision

Portarium is not ready for broader business use yet. It is ready to continue a
contained, internal pilot with explicit stop-loss rules, stubbed external System
of Record effects, and no public production claim.

The technical governance loop is materially stronger than the baseline demo
stack: approval queues, Separation of Duties, restart persistence, recovery
visibility, Evidence Artifact completeness, redaction checks, and plugin
fail-closed controls are now covered by deterministic tests and curated
artifacts. The real-world usefulness case is still inconclusive because the
source-to-micro-SaaS self-use alpha has a runbook and fixture, but no committed
three-run pilot ledger across seven calendar days, no medium-or-better baseline
comparison, and no accepted useful-outcome scorecard.

Under `governed-pilot-usefulness-scorecard-v1`, the current posture cannot be
`Success`: baseline comparison confidence is `low`, and the required real pilot
sample is not present. This is a rollout failure, not a reason to stop the
contained pilot. The right next move is to keep the pilot bounded and convert
every remaining gap into tracked Beads.

## Evidence Reviewed

| Evidence                                                                                          | What it proves                                                                                                                                        | Limit                                                                                                      |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `.specify/specs/governed-pilot-usefulness-scorecard-v1.md`                                        | Stable metric names, thresholds, and guardrail vetoes for pilot usefulness.                                                                           | Requires baseline and pilot observations; current self-use evidence does not satisfy that bar.             |
| `docs/internal/governance/source-to-micro-saas-self-use-alpha.md` and `.json`                     | Narrow self-use alpha plan, rollback protocol, event vocabulary, and ledger template.                                                                 | The pilot window starts 2026-05-03 and the required recurring Run evidence is not yet committed.           |
| `experiments/iteration-2/results/micro-saas-agent-stack-v2/deterministic-handoff-v2/*`            | Operator-team handoff, SoD, request-changes/denial isolation, queue metrics, and complete evidence bundle.                                            | Deterministic single-run scenario, not a real recurring self-use workflow.                                 |
| `experiments/iteration-2/results/micro-saas-toolchain-redo/toolchain-realism-v2/*`                | Tool disposition is recorded; external publish/send effects stay stubbed.                                                                             | Outcome is `inconclusive`; required `content-machine` is unavailable and demo path is unproven.            |
| `experiments/iteration-2/results/governed-resume-recovery/deterministic-recovery/*`               | Pending approvals survive interruption; resumed effects execute exactly once; evidence chains continue.                                               | Provider outage remains a blocked state, not a completed live recovery.                                    |
| `experiments/iteration-2/results/shift-aware-approval-coverage/deterministic-shift-coverage-v1/*` | Delegation windows, eligibility rejection, escalation, SoD, and after-hours coverage are evidence-backed.                                             | Deterministic; not yet tied to real pilot operator workload diaries.                                       |
| `experiments/iteration-2/results/production-like-pilot-rehearsal/pilot-rehearsal-v1/*`            | Queue p95 250000ms under 300000ms SLO, resume latency 850ms under 1000ms SLO, duplicate executions 0, restart persistence survived, redaction passed. | Browser screenshots are classified as a test limitation; external SoR effects are stubbed.                 |
| `docs/internal/review/artifacts/bead-1138/live-stack/latest/index.json`                           | Cockpit live-stack release evidence requirements are defined.                                                                                         | Latest manifest is a pointer/checklist; staging or production auth is still outside this evidence.         |
| `scripts/integration/scenario-operator-trust-calibration.test.ts`                                 | Deterministic calibration scenario surfaces rubber-stamping, opacity, friction, fatigue shortcuts, and training gaps.                                 | Synthetic mixed queue; not a measured live operator diary.                                                 |
| `.specify/specs/operator-plugin-governance-controls-v1.md` and extension tests                    | Cockpit extension manifests, guards, emergency disable, route access, and fail-closed behavior are tested.                                            | Not yet red-teamed through a live pilot path with generated operator surfaces and Browser Egress evidence. |

## Baseline Versus Pilot

| Scorecard field                   | Baseline state                                                                                           | Current pilot/self-use evidence                                                                                                                        | Decision                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `baseline_sample_size_runs`       | Planned manual baseline minimum is 3 for self-use alpha; scorecard success needs medium/high confidence. | No committed baseline observation set for the chosen self-use workflow.                                                                                | Failure for broad rollout.                                      |
| `pilot_sample_size_runs`          | Expected at least 3 recurring self-use Runs across at least 7 calendar days.                             | Deterministic rehearsals exist; real self-use ledger is not committed.                                                                                 | Inconclusive.                                                   |
| `operator_minutes_per_run`        | Manual source research, backlog shaping, implementation planning, QA notes, and release/rollback notes.  | Deterministic artifacts do not include comparable active operator minutes for real self-use Runs.                                                      | Inconclusive.                                                   |
| `approval_latency_ms_p95`         | Baseline wait time not captured as comparable observations.                                              | Rehearsal p95 is 250000ms; micro-SaaS handoff p95 is 26000ms; shift-aware p95 is 3600000ms at threshold.                                               | Improved technically; not yet comparable to baseline.           |
| `blocked_duration_ms_p95`         | Baseline approval/handoff wait not captured.                                                             | Recovery scenario p95 is 4200000ms during interruption; rehearsal p95 is 250000ms.                                                                     | Mixed; recovery is visible but provider outage remains blocked. |
| `throughput_per_operator_per_day` | Not measured.                                                                                            | Useful outcome acceptance for real self-use is not committed.                                                                                          | Inconclusive.                                                   |
| `denial_rate` and `rework_rate`   | Not measured in baseline.                                                                                | Deterministic rehearsal records one request-changes out of three approvals; micro-SaaS handoff records one denial and one request-changes out of five. | Useful defect discovery, but not comparable.                    |
| `duplicate_execution_rate`        | Baseline duplicate-work events not captured.                                                             | 0 in micro-SaaS handoff, recovery, shift-aware coverage, and production-like rehearsal.                                                                | Improved guardrail evidence.                                    |
| `unsafe_action_escape_rate`       | Not measured.                                                                                            | No unsafe-action escapes recorded in deterministic evidence; external SoR effects remain stubbed.                                                      | Healthy within stubbed boundary.                                |
| `policy_violation_escape_rate`    | Not measured.                                                                                            | SoD and eligibility are preserved in deterministic evidence.                                                                                           | Healthy within deterministic boundary.                          |
| `cost_per_useful_outcome`         | Not measured.                                                                                            | Model/tool/operator cost per accepted self-use outcome is not committed.                                                                               | Inconclusive.                                                   |
| `business_kpi_delta_primary`      | Not measured.                                                                                            | Accepted software Artifact packages per week are not committed.                                                                                        | Inconclusive.                                                   |

## What Improved

- Approval queue behavior is now measurable. Deterministic scenarios record
  pending age, resume latency, queue depth, denials, request-changes,
  duplicate-execution count, restart count, and evidence completeness.
- Recovery readiness improved. Pending approvals, Plans, and Evidence state
  survive crash/restart/deploy variants; resumed effects execute once; Cockpit
  exposes waiting or degraded states.
- After-hours and workload routing improved. Shift-aware coverage records
  delegation windows, assignment changes, eligibility rejection, escalation, and
  SoD-preserving decisions.
- Policy management is no longer only a backend primitive. The policy change
  workflow is versioned, scoped, auditable, approval-aware, replay-capable, and
  rollback-aware; Policy Studio and focused approval review follow-up work has
  been completed.
- Plugin governance has strong schema and host-guard coverage. Missing
  governance metadata, weak guards, duplicate routes, unsafe paths, missing route
  modules, unavailable capabilities, and emergency-disabled extensions fail
  closed in tests.

## What Regressed Or Remains Weak

- The strongest real-use claim regressed from "pilot ready" to "pilot planned."
  The self-use alpha fixture sets `plannedStartIso` to 2026-05-03, but the report
  cannot find the required recurring Run ledger.
- Toolchain realism regressed at the Machine boundary. The latest
  `micro-saas-toolchain-redo` artifact is `inconclusive` because the required
  `content-machine` CLI is not available. That blocks a useful-output claim for
  the micro-SaaS Artifact path.
- Browser QA is still not release-candidate evidence. The production-like
  rehearsal records browser verification commands and expected screenshot paths,
  but classifies the missing headed run as a test limitation.
- Stop-loss posture is strained. `docs/internal/governance/stop-loss-thresholds-status.md`
  records a halt decision from unresolved open decisions, orphaned beads, and
  unowned open beads. That does not block the contained pilot by itself, but it
  argues against broader rollout while operational backlog hygiene is weak.

## Inconclusive Areas

- Real operator effort: no comparable `operator_minutes_per_run` dataset exists
  for baseline versus governed self-use.
- Business value: no committed primary KPI delta for accepted software Artifact
  packages per week.
- Cost: no model/tool/operator cost per accepted self-use outcome.
- Verification sampling: the contract exists, but pilot evidence does not yet
  report completed count, sampled count, defect rate, and confidence by Action
  class.
- Live System of Record posture: external effects remain stubbed. That is the
  correct safety boundary for this stage, but it means broader business use is
  unproven.

## Operator Trust And Fatigue

The deterministic trust-calibration scenario is useful because it catches the
right categories: rubber-stamping risk, opaque context, unnecessary friction,
fatigue shortcuts, and training gaps. Its nine-case mixed queue implies:

- one high-risk fast approval/rubber-stamping case,
- two opaque-context cases,
- one unnecessary low-risk friction case,
- one fatigue shortcut after consecutive fast approvals,
- one training gap where the decision was correct but confidence was low.

This supports the readiness model's concern that static RBAC is insufficient.
Operators need current readiness, workload limits, evidence sufficiency, and
verification sampling. It does not yet prove live trust. The next self-use
window must record operator diaries or equivalent Evidence Events for steering,
review, approval, fixing, and closeout.

## Recovery And Policy Readiness

Recovery is ready for contained pilot use under deterministic conditions:

- state survival is confirmed for approval, run, policy, and Evidence stores;
- duplicate execution remains zero in the reviewed recovery and rehearsal
  evidence;
- Cockpit exposes waiting/degraded recovery states;
- the production-like rehearsal survives process/API/worker restart.

Recovery is not ready for broad use because provider outage remains a blocked
state, live external effects are stubbed, and headed browser evidence is still
missing for the release-candidate flow.

Policy management is ready for contained pilot use with maker-checker discipline:
the Policy change workflow supports diff, scope, expiry, replay report evidence,
approval, application, rejection, supersession, and rollback. It is not ready to
be treated as a self-service customer surface until policy-linked review is
validated against real pilot operators and verification-sampling coverage proves
that lower approval volume does not hide defects.

## Plugin And Agent-Generated UI Residual Risk

The plugin host has meaningful fail-closed controls: extension manifests require
governance metadata, version pins, permission grants, guards, and lifecycle
controls; disabled/quarantined/emergency-disabled extensions expose no routes,
navigation, or commands; external route resolution denies missing or unsafe
contexts with audit metadata.

Residual risk remains because the reviewed evidence is mostly schema and unit
coverage, not a live pilot red-team. Agent-generated operator surfaces are
especially sensitive: they must stay typed data, not arbitrary executable code,
and they must not become a bypass around Policy, Approval Gates, Evidence,
tenancy, Browser Egress, or emergency disable. Broader business use needs a
pilot-path security rehearsal that proves these controls with live-stack
evidence.

## Recommendation

Continue the contained pilot with these constraints:

- keep the readiness label at `self-use` or `pilot-candidate`, not broader
  business use;
- keep external System of Record effects stubbed unless a separate production
  gate approves real effects;
- require the self-use alpha ledger and usefulness scorecard before any Success
  claim;
- require headed browser evidence for the production-like operator flow;
- require verification-sampling coverage before using reduced approval volume as
  a positive signal;
- freeze or roll back the pilot if duplicate execution, unsafe-action escape,
  policy-violation escape, repeated unremediated exception fingerprints, or
  stop-using-it events occur.

## Follow-Up Beads Created

| Bead        | Gap                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------- |
| `bead-1148` | Complete the real source-to-Micro-SaaS self-use alpha ledger and scorecard export.          |
| `bead-1149` | Resolve the required `content-machine` pilot preflight failure and rerun toolchain realism. |
| `bead-1150` | Capture headed live-browser evidence for the production-like pilot rehearsal.               |
| `bead-1151` | Publish verification-sampling coverage for the contained pilot.                             |
| `bead-1152` | Red-team plugin and agent-generated UI pilot paths.                                         |

## Final Gate

The next readiness decision can move from `continue-contained-pilot` to `go`
only if:

1. the self-use alpha has at least medium baseline confidence and three accepted
   governed Runs across at least seven calendar days,
2. all safety veto metrics remain zero,
3. real operator effort and cost per useful outcome are measured,
4. live operator-flow browser evidence is captured,
5. plugin/generated UI live-path residual risks have no blocking findings, and
6. verification sampling shows hidden defects are visible and routed.
