# Cockpit Approval Card Review Depth v1

## Purpose

Define the shared information architecture and escalation contract for Cockpit Approval Gate cards. The contract is named `ApprovalCardReviewDepthV1` in implementation and applies to mobile triage and desktop control-room review.

## Data sources

The card derives its contract from existing Cockpit data only:

- `ApprovalSummary`
- `Plan.plannedEffects` / `PlanEffect`
- `EvidenceEntry`
- `RunSummary`
- `WorkflowSummary`

No backend field is required for review depth. Cockpit derives risk tier, review depth, and friction from the policy rule, Run execution tier, Plan effects, evidence chain, agent action metadata, SoD state, and decision history already present on those objects.

## Mandatory card fields

Every Approval Gate card must expose the same semantic fields on mobile and desktop:

- Proposed Action
- Goal or intent
- Systems touched
- Policy result
- Blast radius
- Reversibility
- Evidence
- Rationale
- Prior related Actions

Desktop may show more surrounding panels and larger grids. Mobile may stack the same fields and keep decision controls sticky or nearby. Neither surface may omit the fields or change the governance meaning.

## Review depth

`fast-triage` is allowed only when the derived risk tier is low:

- no escalation lock
- no full or partial irreversibility
- no delete effects
- no dangerous tool category
- one touched system
- three or fewer affected records when a record count can be derived
- evidence is present and the chain is not broken
- policy and Run tier are not `HumanApprove` or `ManualOnly`
- current approver is not SoD-blocked

`deep-review` is required when any material escalation reason is present but approval is still allowed:

- `HumanApprove` policy or Run tier
- partial irreversibility
- multiple systems touched
- more than three affected records
- missing evidence
- agent action category is not enough by itself unless the category is `Dangerous`

`high` risk deep review adds stronger friction when the Action is irreversible, destructive, dangerous, or has a broken evidence chain:

- rationale is required before approval
- approval requires a second explicit confirmation
- review context must be visibly expanded before decision controls can be considered complete

`escalation-lock` is required when governance forbids this approver or this approve path:

- SoD blocks the current approver
- policy or Run tier is `ManualOnly`

In an escalation lock, Cockpit must explain the lock reason and prevent direct approval from the card.

## Friction rules

Low-risk cards keep approval fast: approval may be submitted without rationale, while denial and request changes still require rationale under the swipe-triage contract.

Elevated cards surface the full `ApprovalCardReviewDepthV1` field set and escalation reasons. They remain decidable but are visually marked as deep review.

High-risk cards require rationale and a second confirmation before approval. A swipe approval must obey the same validation state as a button or keyboard approval.

Escalation-locked cards disable approval and show the lock reason. Deny, request changes, and skip remain available when the existing decision flow allows them.

## Traceability

- `apps/cockpit/src/components/cockpit/triage-card/approval-card-contract.ts`
- `apps/cockpit/src/components/cockpit/triage-card/approval-card-contract-panel.tsx`
- `apps/cockpit/src/components/cockpit/triage-card/approval-triage-card.tsx`
- `apps/cockpit/src/components/cockpit/triage-card/triage-decision-area.tsx`
- `.specify/specs/cockpit-approvals-v2-swipe-triage-v1.md`
