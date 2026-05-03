# Operator Readiness And Calibration

This guide applies
`.specify/specs/governed-autonomy-readiness-calibration-v1.md` to controlled
Portarium pilots and governed autonomy operations. Use it when preparing a
pilot, reviewing an approval queue, or deciding whether a person should steer,
approve, audit, own Policy, or advise as a domain SME.

## Model

Treat human oversight as four separate questions:

| Question        | Meaning                                                        | Example failure                                                     |
| --------------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| Authority       | Is this actor allowed to take this decision?                   | The user is not an approver for payment Actions.                    |
| Readiness       | Is this actor prepared to use that authority right now?        | The user is overloaded, outside coverage, or lacks current context. |
| Training status | Has required onboarding or recurrent enablement been met?      | The user never completed the pilot Approval Gate scenario.          |
| Calibration     | Does recent behaviour show appropriate reliance on the system? | The user approves high-risk Plans without checking cited evidence.  |

Do not collapse these into RBAC. RBAC is necessary, but it cannot prove that
oversight is meaningful under workload, fatigue, or skill-decay pressure.

## Eligibility Profile

Define one eligibility profile for each governance function in the pilot.

| Function     | Required evidence before assignment                                                                                  | Common route when not ready                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Operator     | Completed workflow walkthrough, knows Run state, escalation queue, and current-Run authority                         | Handoff to ready operator or pause until coverage exists           |
| Approver     | Action-class authority, domain competence, SoD clearance, Plan and evidence review exercise                          | Escalate to higher approver or request domain SME input            |
| Auditor      | Evidence Log literacy, sampling plan, independence from the decision, retention and privacy rules                    | Assign alternate auditor or reduce pilot scope                     |
| Policy owner | Policy simulation exercise, rollback path, blast-radius review, maker-checker partner                                | Keep Policy change in draft or route to alternate policy owner     |
| Domain SME   | Current domain competence, explicit advice boundary, evidence needed for correctness, named approver when applicable | Attach SME advice but route the final decision to a ready approver |

Each profile should name the action classes, Workspace scope, expiry period,
refresh cadence, and evidence used to prove readiness.

## Readiness States

Use these states in pilot notes and future product surfaces:

| State                | Meaning                                                                  | Decision handling                                               |
| -------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `ready`              | Authority and required readiness evidence are current.                   | Actor may decide within scope.                                  |
| `ready-with-limits`  | Actor may decide only within a narrower class, budget, or time window.   | Surface limits near the decision.                               |
| `training-pending`   | Authority may exist, but required onboarding is incomplete.              | Block high-impact decisions; allow shadowing where appropriate. |
| `calibration-review` | Recent behaviour suggests over-trust, over-scepticism, or weak review.   | Route high-impact work away until review is complete.           |
| `workload-blocked`   | Volume, queue pressure, fatigue, or coverage makes oversight unreliable. | Handoff, escalate, pause, or reduce queue load.                 |
| `not-eligible`       | Actor lacks the required authority, competence, SoD, or independence.    | Do not assign the decision; route to an eligible function.      |

## Workload And Fatigue Limits

Set limits before the pilot starts. At minimum, define:

- maximum approval prompts per person per hour for each action class
- maximum continuous review window before a break or handoff
- quiet hours and after-hours coverage
- queue age threshold that triggers escalation
- stop-loss threshold for repeated near misses, overrides, or rushed approvals
- evidence packet size threshold that requires deeper review or summarisation

When a limit is exceeded, the response is routing or scope control, not a note
that the operator should try harder.

## Calibration Practice

Use the operator trust calibration eval to inspect queue behaviour:

```bash
node node_modules/vitest/vitest.mjs run scripts/integration/scenario-operator-trust-calibration.test.ts
```

Review these signals:

- fast high-risk approvals
- low-risk cases that consume excessive review effort
- missing evidence that operators fail to notice
- correct decisions made with low confidence
- repeated requests for evidence that Policy should have required upfront
- escalations that were appropriate but treated as delays

Classify recommendations as `policy`, `ux`, or `training`, matching
`docs/how-to/run-operator-trust-calibration.md`.

## Verification Sampling

Create a sampling cadence before enabling broader autonomy. The normative
contract is
`.specify/specs/delegated-autonomy-verification-sampling-v1.md`.

| Sample type              | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| Low-risk Auto sample     | Prevent passive trust drift during long successful runs.          |
| Assisted Run second look | Confirm evidence and rationale supported the human decision.      |
| Bad Plan replay          | Check that operators still catch plausible but wrong proposals.   |
| Weekly digest review     | Look for near misses, override patterns, and evidence gaps.       |
| Auditor sample           | Confirm the Evidence Log can reconstruct authority and rationale. |

Sampling findings feed enablement, evidence packet quality, Policy
calibration, and approval routing. They do not silently change Policy.

Configure sampling rules by Action class, Execution Tier, blast radius,
novelty, and track record. Increase sampling during drift, incidents, new
capability rollout, or degraded provider posture. Track outcomes as
`correct`, `risky-but-allowed`, `should-have-escalated`, `policy-too-strict`,
or `evidence-insufficient` so findings can route to reusable Policy, runbook,
prompt strategy, or operator enablement work.

For pilot readiness, record Cockpit coverage by capability or Action class:
completed count, sampled count, sampling coverage, defect rate, and current
confidence. Do not treat reduced approval volume as success unless this
coverage shows defects are still visible.

## Pilot Gate Checklist

Before a governed autonomy pilot proceeds, record:

- required functions: operator, approver, auditor, policy owner, domain SME
- named ready actors or Workforce Queues for each function
- authority source for each high-impact action class
- readiness state and expiry for each assigned actor or queue
- unresolved training or calibration gaps
- workload limits and escalation route
- verification sampling owner and cadence
- sampling coverage and current confidence by selected capability or Action
  class
- go/no-go decision for any remaining gap

If the checklist cannot prove that oversight is prepared in practice, the pilot
is not ready even when the approval queue is populated.
