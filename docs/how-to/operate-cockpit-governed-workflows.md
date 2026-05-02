# Operate Cockpit Governed Workflows

This guide is the first controlled-pilot onboarding path for operators using
Cockpit to run Portarium-governed workflows. It assumes Cockpit is already
connected to a Workspace with seeded or pilot-approved workflows, policies,
approvers, and Evidence Log storage.

Use this guide when you are the person launching, steering, approving,
handing off, or recovering a Run. Use
[Run The Operator Trust Calibration Eval](run-operator-trust-calibration.md)
when you need to evaluate whether the approval queue is teaching appropriate
reliance or approval fatigue.

## Operator Readiness

Before operating a pilot workflow, confirm:

- You are signed in to the correct Workspace.
- Your current function is clear: operator, approver, auditor, policy owner,
  domain SME, or platform admin.
- You know whether the workflow is `Auto`, `Assisted`, `Human-approve`, or
  `Manual-only`.
- You can see the Run, Approval Gate, Plan, Policy result, and Evidence
  Artifacts that support the current decision.
- You know the backup Workforce Queue or named person for escalation.
- You know whether the current action affects only this Run or future Policy.

Do not approve, resume, roll back Policy, or re-enable a plugin if any of
those checks are unclear. Request changes or escalate instead.

## First Run Path

1. Open Cockpit and select the pilot Workspace.
2. Open the Workflows surface and choose the pilot-approved workflow.
3. Inspect the workflow goal, trigger, Execution Tier, Policy summary, and
   linked recent Runs.
4. Start the Run only if the intent, scope, and success condition match the
   pilot script.
5. Open the Run detail view and confirm the Plan names the proposed Actions,
   affected systems, constraints, blast radius, reversibility, and required
   evidence.
6. Let low-risk `Auto` Actions continue when their Policy result, evidence,
   and track record match expectations.
7. For any Approval Gate, use the normal-run playbook below.
8. After the Run resolves, inspect the Evidence Log for the final decision,
   verified effects, and any Work Item or ExternalObjectRef links.
9. Record pilot notes as operator enablement feedback, not as a hidden Policy
   change.

## Normal-Run Playbooks

### Approve

Use approve when the proposed Plan is correct, in scope, sufficiently evidenced,
permitted by Policy, and within your authority.

1. Confirm the Approval Gate is assigned to you or your Workforce Queue.
2. Inspect the Plan, Policy rationale, Execution Tier, blast radius,
   reversibility, and key Evidence Artifacts.
3. Check Separation of Duties: you must not be the sole approver for a risky
   Action you proposed or initiated.
4. Confirm there are no missing-evidence, stale-state, or degraded-realtime
   warnings.
5. Approve with a concise rationale that names the evidence relied on.
6. Verify the Run resumes or records the approved state.

Stop and escalate instead when the action is irreversible, high-blast-radius,
or outside the pilot scope.

### Deny

Use deny when the proposed Action should not run as presented.

1. Inspect whether the issue is wrong goal, wrong evidence, wrong risk level,
   wrong execution plan, missing context, policy violation, insufficient
   quality, or domain-correctness failure.
2. Confirm denial affects the current Approval Gate or Run, not future Policy.
3. Deny with a structured reason and cite evidence where possible.
4. Add whether the correction belongs to the current Run, workflow definition,
   prompt or agent strategy, Policy rule, or operator enablement.
5. Verify the Run moves to the expected blocked, failed, or resolved state.

Do not use denial to silently change future thresholds. File or route a Policy
change request for future behavior.

### Request Changes

Use request changes when the goal is acceptable but the Plan, evidence, scope,
or quality bar needs revision before the action can run.

1. State the required change in outcome terms, not low-level execution steps.
2. Attach the missing or contradictory Evidence Artifact when one exists.
3. Narrow the scope if the current blast radius is too broad.
4. Route the feedback to `current-run` unless it should influence future
   workflow or Policy behavior.
5. Verify the Run returns with a revised Plan before any approval is requested
   again.

If the same change request repeats, escalate to the workflow owner or policy
owner rather than continuing the loop.

### Handoff

Use handoff when another operator or Workforce Queue should own the current
Run, but the authority level does not need to increase.

1. Confirm the new owner or queue has the required role and coverage.
2. Summarize current Run status, open blocker, last intervention, deadline,
   and next safe action.
3. Include links to the relevant Plan, Approval Gate, Evidence Artifacts, and
   Work Item.
4. Submit handoff with the previous and new owner visible in the audit entry.
5. Verify the Run shows `handoff-pending` or the new owner before leaving the
   work unattended.

Handoff transfers ownership. It does not erase prior decisions or rationale.

### Escalation

Use escalation when the decision exceeds your authority, domain competence,
available evidence, or time budget.

1. Classify the escalation target: approver, domain SME, policy owner,
   platform admin, auditor, or another Workforce Queue.
2. Preserve the current state; do not approve or resume while escalating.
3. Include why escalation is needed: authority gap, evidence gap, Policy
   conflict, high blast radius, suspected incident, or after-hours coverage.
4. Attach the current Plan, Policy result, Evidence Artifacts, and suggested
   next safe action.
5. Verify the receiving function is accountable for the next decision.

If there is immediate risk to a Workspace or external system, use the relevant
incident playbook instead of routine escalation.

## Incident Playbooks

### Stuck Run

Use this when a Run is not progressing and Cockpit shows pending, running,
waiting, blocked, or stale state longer than the workflow SLO allows.

1. Confirm the Run status and Cockpit realtime freshness. Refresh or reopen the
   Run detail if Cockpit reports degraded realtime.
2. Inspect the latest Evidence Log entry, current Action, retry count,
   timeout, and open Approval Gate or Human Task.
3. Check whether the Run is waiting for a human, a connector, a machine, or a
   Policy decision.
4. If it is waiting for a human, hand off or escalate to the correct Workforce
   Queue.
5. If it is waiting for a connector or machine, pause or freeze if permitted,
   then escalate to the platform admin or owning adapter team.
6. If it is policy-blocked, do not override inline. Route to policy owner with
   the Policy result and Run evidence.
7. Record an audit annotation with the diagnosis and next owner.

Resume only after the blocker is cleared and the evidence shows the Plan is
still valid.

### Broken Resume

Use this when a Run should resume after approval, change request resolution, or
manual blocker clearance but does not continue.

1. Confirm the approval, change response, or manual completion was recorded in
   the Evidence Log.
2. Confirm the Run is not frozen, cancelled, failed, superseded, or waiting on
   a different Approval Gate.
3. Inspect Policy and Execution Tier again; a Policy change may have made the
   previous resume path invalid.
4. Attempt resume only through the Cockpit or Control Plane command path
   available to your role.
5. If resume fails again, freeze the Run where permitted, annotate the failed
   resume, and escalate to platform admin with the Run ID, correlation ID,
   approval ID, and latest evidence entry.
6. Do not start a duplicate Run unless the workflow owner confirms idempotency
   and duplicate external effects are impossible or already compensated.

### Plugin Disable

Use this when a Cockpit Extension or operator plugin appears unsafe, stale,
misconfigured, or in violation of governance controls.

1. Identify the plugin manifest ID, package version, Workspace activation, and
   affected route or command.
2. Confirm the suspected issue: permission mismatch, egress denial, stale
   version, malformed manifest, unsafe route behavior, or audit failure.
3. Preserve evidence: screenshot if available, route or command ID, user,
   Workspace, correlation ID, and denial or error text.
4. Emergency-disable the plugin only through the governed host control
   available to a platform admin or break-glass procedure.
5. Verify routes, navigation, commands, shortcuts, and plugin data loading are
   suppressed.
6. Notify the workflow owner and affected operators with the alternate manual
   path or safe Cockpit surface.
7. Re-enable only after the manifest, version pin, permission grants, and audit
   obligations are verified.

Plugin disable is a Workspace safety action. It must not be used to bypass
Policy or hide an audit trail.

### Policy Rollback

Use this when a recently applied Policy change is causing unsafe approvals,
unexpected blocks, excess automation, or excess manual load.

1. Identify the active policy version, policy change ID, scope, proposer,
   approver, effective time, and whether the change applies to active Runs.
2. Collect examples: affected Runs, Approval Gates, Policy rationale, and
   observed wrong outcome.
3. Simulate or replay where available before rollback, especially for
   high-risk changes.
4. Create or route a first-class rollback Policy change. Do not edit policy
   state directly.
5. Apply maker-checker rules: the risky change proposer must not be the only
   rollback approver.
6. For emergency rollback, record the break-glass authority source, expiry,
   and required after-action review.
7. Verify the previous policy version is active for the intended scope and
   that affected active Runs are paused, resumed, or re-evaluated according to
   the rollback record.

Rollback changes future governance and may affect active Runs only when the
Policy change explicitly says so.

## Trust Versus Inspect

Trust means bounded reliance on Policy, evidence, track record, and reversible
execution. It does not mean accepting fluent rationale without inspection.

Use the fast path when all are true:

- The Action is low-risk or routine for this Workspace.
- Policy matched the expected Execution Tier.
- Evidence is fresh, relevant, and sufficient.
- The blast radius and reversibility are acceptable.
- Similar recent Runs succeeded without near misses.
- You understand the current authority you are exercising.

Inspect deeply when any are true:

- The action is irreversible, high-blast-radius, novel, or externally visible.
- Evidence is missing, stale, contradictory, or too summarized.
- The agent rationale is confident but does not cite usable evidence.
- Policy rationale surprises you or differs from the pilot script.
- The Run involves credentials, money movement, customer communication,
  compliance, security, or production data changes.
- You are fatigued, rushed, outside your domain competence, or acting outside
  normal coverage.
- Cockpit reports degraded realtime or stale state.

Escalate instead of deciding when inspection still does not produce confidence.

## Pilot Exit Criteria

A first controlled pilot operator is ready to run without hands-on support when
they can demonstrate:

- starting a governed workflow from Cockpit with the correct Workspace and
  workflow intent
- approving one safe Approval Gate with cited evidence
- denying or requesting changes for one intentionally bad Plan
- handing off or escalating with context continuity
- diagnosing a stuck Run from Cockpit state and Evidence Log entries
- explaining when they used fast-path trust versus deeper inspection
- describing who can disable a plugin and who can roll back Policy

Record gaps as operator enablement feedback, workflow changes, or Policy change
requests. Do not treat pilot training gaps as UI bugs unless the Cockpit surface
omits required information.
