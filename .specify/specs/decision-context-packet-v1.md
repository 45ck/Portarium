# Decision Context Packet v1

**Status:** Proposed  
**Related Beads:** bead-1050, bead-1058, bead-1074, bead-1075, bead-1076
**Extends:** [Operator Interaction Model v1](./operator-interaction-model-v1.md)

## Purpose

Define the shared evidence sufficiency packet a human needs before approving,
denying, steering, overriding, or changing Policy for governed work.

The packet prevents raw-log archaeology. Cockpit surfaces should consume the
same shape for Approval Gates, Run steering, override review, and Policy change
activation.

## Minimum Packet

Every packet must include:

- declared goal
- scope boundary
- current step
- next-step preview
- proposed Action, steering change, override, or Policy change
- blast radius and reversibility label
- Policy rationale and Execution Tier
- budget impact and compliance implications
- uncertainty, anomaly, and unknown signals
- required Evidence Artifact list and consulted evidence
- missing-evidence signals
- provenance for material upstream agent-generated inputs
- allowed next actions, including `request-more-evidence` when context is insufficient

## Sufficiency States

| State          | Meaning                                                                | Allowed posture                                                  |
| -------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `sufficient`   | Required evidence, rationale, blast radius, and provenance exist       | Approve, deny, steer, request changes, or other permitted action |
| `insufficient` | Required evidence is missing but the packet is otherwise coherent      | Request more evidence, escalate, or annotate                     |
| `blocked`      | Core context such as Policy rationale, target, or provenance is absent | Escalate or annotate until rebuilt                               |

Missing evidence must be shown as a first-class state. It must not be hidden in
a fluent summary.

## Runtime Contract

The TypeScript contract is implemented in
`src/domain/approvals/decision-context-packet-v1.ts`.

Core functions:

- `validateDecisionContextPacket`
- `assessDecisionContextSufficiency`

## Acceptance Signals

- Approval, steering, and Policy-change surfaces can consume the same packet shape.
- Operators can see goal, scope, next step, blast radius, reversibility, Policy, budget, compliance, uncertainty, and provenance without reading raw logs.
- Missing evidence produces `insufficient`, not a fake binary approve/deny choice.
- `request-more-evidence` remains available when the packet is incomplete but recoverable.
- Cockpit Run interventions use the same action vocabulary for steering,
  escalation, containment, emergency disable, and audit annotation.
