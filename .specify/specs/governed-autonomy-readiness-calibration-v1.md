# Governed Autonomy Readiness And Calibration v1

## Purpose

Define the human readiness model for governed autonomy in Portarium. The model
answers whether a person or team is prepared to steer, approve, audit, own
Policy, or advise on high-impact governed work.

This specification extends the authority and accountability contract in
[operator-interaction-model-v1.md](./operator-interaction-model-v1.md). It does
not replace RBAC, Policy, or Approval Gate semantics. RBAC answers what a user is
authorised to attempt. Readiness answers whether that authority is currently
valid enough to use.

## Scope

This model applies to:

- controlled pilot readiness gates
- operator onboarding and recurrent enablement
- trust calibration and approval-fatigue evaluation
- approval routing and escalation criteria
- audit sampling and anti-skill-atrophy practices

This model does not define Cockpit UI implementation, employment policy, or a
formal learning-management system.

## Required Semantics

### R1 Eligibility extends beyond RBAC

An organisation must be able to define eligibility requirements for each
governance function and action class. Eligibility can include:

- domain competence for the affected process, SoR, customer, or Workspace
- AI literacy for interpreting model output, uncertainty, evidence gaps, and
  misleading fluency
- completion of onboarding or recurrent training
- successful calibration exercises or scenario reviews
- current workload, coverage window, and fatigue state
- Separation of Duties and conflict-of-interest checks
- recent verification or audit sampling participation

Static RBAC labels alone are insufficient for high-impact work.

### R2 Authority is separate from readiness and training status

Every non-routine decision must be able to distinguish:

- `authoritySource`: why the actor is allowed to take the decision
- `readinessStatus`: whether the actor is prepared to use that authority now
- `trainingStatus`: whether required onboarding or recurrent enablement is
  complete, expired, waived, or pending
- `calibrationState`: whether recent decisions show appropriate reliance,
  blanket trust, blanket scepticism, or insufficient evidence use

A user may have authority but still be blocked, routed, or required to escalate
because readiness is stale, workload is unsafe, or calibration evidence is weak.

### R3 Function-specific readiness

Readiness requirements differ by governance function:

| Function     | Primary decision surface                              | Minimum readiness evidence                                                                                   |
| ------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Operator     | Starts, steers, hands off, freezes, or escalates Runs | Workflow mental model, current-Run authority, evidence inspection, escalation path, workload self-check      |
| Approver     | Approves, denies, or requests changes at a gate       | Action-class authority, domain competence, SoD clearance, Plan review skill, evidence citation discipline    |
| Auditor      | Reviews evidence after execution                      | Evidence Log literacy, sampling method, independence, ability to identify missing or misleading audit record |
| Policy owner | Changes Policy, routing, tiers, or evidence rules     | Policy simulation skill, rollback path knowledge, blast-radius judgement, maker-checker discipline           |
| Domain SME   | Advises on domain correctness                         | Current domain expertise, known limit of advice, evidence needed for correctness, escalation to approver     |

Domain SME advice can support a decision, but it is not itself Approval Gate
authority unless the actor also satisfies approver authority and readiness.

### R4 Calibration targets appropriate reliance

The desired behaviour is appropriate reliance:

- fast-path acceptance when risk, evidence, Policy, and track record justify it
- deeper inspection when the action is novel, high risk, irreversible, or
  under-evidenced
- request for more evidence when confidence is not justified
- escalation when authority, competence, evidence, or workload is insufficient

Training must not teach blanket trust or blanket scepticism. Calibration must be
measured by action class and context, not by one global trust score.

### R5 Fatigue and workload can invalidate oversight

Readiness is time-bound. A nominally eligible actor is not ready when:

- review volume exceeds the configured interruption budget
- queue age or due times force rushed review
- the actor is outside coverage hours or acting after an excessive shift window
- repetitive low-value prompts are creating approval fatigue
- the evidence packet is too dense to inspect within the expected decision time
- the actor self-declares fatigue, distraction, or lack of current context

Policy and Cockpit surfaces must support routing, queue shaping, escalation, or
stop-loss behaviour instead of treating these states as personal discipline
problems.

### R6 Verification sampling prevents skill atrophy

Organisations must preserve human judgement by periodically sampling work that
would otherwise be trusted or automated. Sampling can include:

- review of selected low-risk Auto or Assisted Runs
- second-look review of approved high-impact Plans
- replay of intentionally bad Plans during onboarding
- weekly digest review of decisions, overrides, near misses, and evidence gaps
- audit checks that compare rationale against the visible evidence packet

Sampling results should feed operator enablement, Policy calibration, evidence
packet quality, and approval routing. They should not silently change authority
or punish good-faith escalation.

### R7 Pilot readiness includes human oversight readiness

A controlled pilot is not ready merely because humans are listed in an approval
queue. The pilot readiness gate must show:

- each required governance function has at least one ready actor or queue
- authority, readiness, training status, and SoD constraints are visible
- workload limits and escalation paths are configured for the pilot window
- trust calibration and verification sampling have an owner and cadence
- unresolved readiness gaps have an explicit mitigation or go/no-go decision

## Integration Points

- [docs/internal/governance/operator-readiness-calibration.md](../../docs/internal/governance/operator-readiness-calibration.md)
  is the maintainer-facing application guide for this model.
- [docs/how-to/operate-cockpit-governed-workflows.md](../../docs/how-to/operate-cockpit-governed-workflows.md)
  remains the operator onboarding guide.
- [docs/how-to/run-operator-trust-calibration.md](../../docs/how-to/run-operator-trust-calibration.md)
  remains the deterministic calibration evaluation entry point.
- [docs/internal/governance/pilot-readiness-sequence.md](../../docs/internal/governance/pilot-readiness-sequence.md)
  sequences this model into the pilot readiness gate.

## Acceptance

- Organisations can define eligibility requirements beyond static RBAC labels.
- Authority, readiness, training status, and calibration state are distinct.
- Workload and fatigue can block, route, or escalate a decision.
- Verification sampling or equivalent anti-skill-atrophy work is required.
- Operator, approver, auditor, policy owner, and domain SME readiness are
  distinct.
- Pilot readiness can answer whether human oversight is actually prepared, not
  only present on paper.
