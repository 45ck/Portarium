# ADR-0031: Separation of Duties as Policy Primitives

## Status

Accepted

## Context

Finance, procurement, and HR workflows require separation of duties (SoD) controls that go beyond simple per-action approvals. Compliance frameworks (SOX, SOC 2) mandate that the person who initiates a transaction cannot also approve it, and that certain duty combinations are incompatible.

## Decision

The policy engine supports multi-step/multi-actor constraints as first-class primitives:

- **Maker-checker:** the initiator of a Run cannot be the approver.
- **N-distinct approvers:** actions above configurable thresholds require N distinct human approvers.
- **Incompatible duty constraints:** policy can declare that certain action combinations within a workflow cannot be performed by the same actor.
- **Cross-step constraints:** SoD rules span the full workflow lifecycle, not just individual actions.

These constraints are evaluated by the PolicyEvaluationService and violations produce SodViolationDetected events logged as evidence.

## Consequences

- Enables real compliance controls for regulated workflows.
- Policy configuration becomes more complex.
- Approval routing must consider SoD constraints when selecting approvers.
- SoD violations are auditable through the evidence chain.
