# Portarium Domain -- Aggregate Boundaries (As Implemented)

> Runtime-aligned invariants and boundaries based on `src/domain/*-v1.ts` and domain services.

## Current Aggregate Roots

- `Workspace`
- Primary types: `WorkspaceV1`, `ProjectV1`
- Key invariants: `workspaceId`/`tenantId` required and branded; timestamps are ISO; project/workspace IDs are branded and non-empty.
- Implementation trace: `src/domain/workspaces/workspace-v1.ts`, `src/domain/workspaces/project-v1.ts`

- `Workflow`
- Primary types: `WorkflowV1`, `WorkflowActionV1`
- Key invariants: `schemaVersion=1`; non-empty ordered actions with contiguous `order` starting at 1; valid `portFamily`; action capability must match family; override tier cannot be less strict than workflow tier.
- Implementation trace: `src/domain/workflows/workflow-v1.ts`, `src/domain/ports/port-family-capabilities-v1.ts`

- `Run`
- Primary types: `RunV1`, `ApprovalV1`, `PlanV1`, `EvidenceEntryV1`, `ArtifactV1`
- Key invariants: `schemaVersion=1`; valid status enum; temporal ordering (`created <= started <= ended` when present); compile-time and runtime guarded state transitions.
- Implementation trace: `src/domain/runs/run-v1.ts`, `src/domain/approvals/approval-v1.ts`, `src/domain/plan/plan-v1.ts`, `src/domain/evidence/evidence-entry-v1.ts`, `src/domain/runs/artifact-v1.ts`, `src/domain/services/run-status-transitions.ts`

- `Policy`
- Primary types: `PolicyV1`, `SodConstraintV1`, `PolicyInlineRuleV1`
- Key invariants: `schemaVersion=1`; valid SoD constraint variants; valid rule effects (`Allow|Deny`); required workspace and creator IDs.
- Implementation trace: `src/domain/policy/policy-v1.ts`, `src/domain/policy/sod-constraints-v1.ts`, `src/domain/services/policy-evaluation.ts`

- `AdapterRegistration`
- Primary types: `AdapterRegistrationV1`
- Key invariants: `schemaVersion=1`; non-empty `capabilityMatrix`; capability-family compatibility; strict execution policy (`PerTenantWorker`, `capabilityMatrix`, `sandboxVerified=true`, https egress).
- Implementation trace: `src/domain/adapters/adapter-registration-v1.ts`, `src/domain/services/capability-enforcement.ts`

- `WorkItem`
- Primary types: `WorkItemV1`
- Key invariants: `schemaVersion=1`; status in `Open|InProgress|Blocked|Resolved|Closed`; thin object shape enforced (unknown fields rejected); SLA due date must not precede create time.
- Implementation trace: `src/domain/work-items/work-item-v1.ts`

- `CredentialGrant`
- Primary types: `CredentialGrantV1`
- Key invariants: `schemaVersion=1`; temporal ordering (`issued <= expires/rotated/revoked` when present); derived status model (`Active|Expired|Revoked|PendingRotation`).
- Implementation trace: `src/domain/credentials/credential-grant-v1.ts`

## Run Lifecycle (Implemented)

Defined in `src/domain/services/run-status-transitions.ts`.

Allowed transitions:

- `Pending -> Running`
- `Running -> Succeeded|Failed|Cancelled|WaitingForApproval|Paused`
- `WaitingForApproval -> Running`
- `Paused -> Running`
- Terminal states: `Succeeded|Failed|Cancelled` (no outgoing transitions)

## Evidence and Artifact Integrity

- Evidence entry chain and hash semantics are implemented in `src/domain/evidence/evidence-chain-v1.ts`.
- Artifact hash/type/retention parsing is enforced in `src/domain/runs/artifact-v1.ts`.

## Canonical Object Boundary

Canonical bridge objects are implemented in `src/domain/canonical/*-v1.ts` and remain intentionally minimal:

- `Party`, `Ticket`, `Invoice`, `Payment`, `Task`, `Campaign`, `Asset`, `Document`, `Subscription`, `Opportunity`, `Product`, `Order`, `Account`, plus `ExternalObjectRef`.
- Vendor-specific details remain in `externalRefs` rather than being normalized into core objects.

## Source of Truth

This document tracks implemented runtime contracts. When parser/service contracts change, update this file in the same PR.
