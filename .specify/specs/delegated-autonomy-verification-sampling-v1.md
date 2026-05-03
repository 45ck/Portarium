# Delegated Autonomy Verification Sampling v1

## Purpose

Define the post-action verification layer for delegated autonomy. The layer
lets Portarium check completed Actions and Runs without forcing every Action
through a blocking Approval Gate.

Verification sampling preserves human judgement, catches silent failure, and
shows whether lower live approval volume is hiding defects.

## Scope

This spec applies after an Action or Run has completed and evidence has been
recorded. It does not replace Policy evaluation, Approval Gates, Execution
Tier enforcement, or exception routing. Live safety incidents still use alert
routing from delegated-autonomy exception handling.

## Required Semantics

### R1 Sampling rules are Policy-owned governance controls

A sampling rule must be able to match completed work by:

- Action class
- Execution Tier
- blast radius
- novelty
- operator, machine, or agent track record

Rules produce a sampling percentage and an audit queue target. Sampling is a
post-action control: a sampled `Auto` or `Assisted` Action remains completed
unless a separate incident, rollback, or Policy process says otherwise.

### R2 Elevated conditions increase sampling

Sampling controls must increase coverage during:

- capability drift
- incidents or post-incident windows
- new capability rollout
- degraded provider posture

The control is expressed as a multiplier over the rule baseline and caps at
100 percent. Elevated sampling must not silently reduce the baseline.

### R3 Audit queue is first class

When a subject is sampled, Portarium creates a dedicated audit queue item with:

- Workspace
- Run and Action references when present
- Action class
- Execution Tier
- queue target
- evidence expectations
- queued timestamp

The audit queue is separate from live Approval Gates. It is allowed to route to
auditor review, policy owner review, or a Workforce Queue.

### R4 Outcomes are structured

Audit reviewers must record one of:

- `correct`
- `risky-but-allowed`
- `should-have-escalated`
- `policy-too-strict`
- `evidence-insufficient`

Free-text notes can add context, but they are not the routing contract.

### R5 Findings route to reusable governance work

Findings must become reusable governance changes rather than one-off notes:

- `risky-but-allowed` routes to Policy change or runbook update.
- `should-have-escalated` routes to Policy change and operator enablement.
- `policy-too-strict` routes to governed Policy change and runbook update.
- `evidence-insufficient` routes to runbook update, prompt strategy, or
  operator enablement.
- `correct` records confidence and does not create governance churn.

Policy changes still use the governed Policy change workflow and maker-checker
controls.

### R6 Cockpit reports coverage and confidence

Cockpit must be able to show, at minimum, by Action class and Execution Tier:

- completed count
- sampled count
- sampling coverage percentage
- defect finding count or rate
- confidence state

The confidence state is not a global trust score. It is a current operational
signal for that capability or Action class.

### R7 Pilot readiness must prove hidden-defect control

Pilot readiness must show that delegated autonomy has enough sampled coverage
to detect missed escalations, evidence gaps, risky-but-allowed behavior, and
overly strict Policy. A pilot cannot claim success only because live approval
volume went down.

## Contract

Implementation:

- `src/domain/policy/delegated-autonomy-verification-sampling-v1.ts`

Contract tests:

- `src/domain/policy/delegated-autonomy-verification-sampling-v1.test.ts`

Primary contract shapes:

- `VerificationSamplingRuleV1`
- `CompletedVerificationSubjectV1`
- `VerificationSamplingDecisionV1`
- `VerificationAuditQueueItemV1`
- `VerificationAuditFindingV1`
- `VerificationFindingRouteV1`
- `VerificationCoverageSummaryV1`

## Traceability

- [Delegated Autonomy Hierarchy v1](./delegated-autonomy-hierarchy-v1.md)
- [Governed Autonomy Readiness And Calibration v1](./governed-autonomy-readiness-calibration-v1.md)
- [Policy Change Workflow v1](./policy-change-workflow-v1.md)
- [Evidence v1](./evidence-v1.md)
- [Run v1](./run-v1.md)

## Acceptance

- Delegated autonomy can be checked without blocking every Action.
- Sampling rules account for Action class, Execution Tier, blast radius,
  novelty, and track record.
- A dedicated post-action audit queue exists with structured queue metadata.
- Review outcomes are structured and route to reusable governance work.
- Drift, incident, rollout, and degraded-provider conditions increase sampling.
- Cockpit can report sampling coverage and confidence by capability or Action
  class.
- Pilot readiness can prove reduced approval volume did not hide defects.
