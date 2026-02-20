# Portarium Domain -- Aggregate Boundaries (As Implemented)

> Runtime-aligned invariants and boundaries based on `src/domain/*-v1.ts` and domain services.

## Current Aggregate Roots

| Aggregate Root | Primary Types | Key Invariants (Implemented) |
| --- | --- | --- |
| Workspace | `WorkspaceV1`, `ProjectV1` | `workspaceId`/`tenantId` required and branded; timestamps are ISO; project/workspace IDs are branded and non-empty. |
| Workflow | `WorkflowV1`, `WorkflowActionV1` | `schemaVersion=1`; non-empty ordered actions with contiguous `order` starting at 1; valid `portFamily`; action capability must match family; override tier cannot be less strict than workflow tier. |
| Run | `RunV1`, run-status transition service | `schemaVersion=1`; valid status enum; temporal ordering (`created <= started <= ended` when present); compile-time + runtime guarded state transitions. |
| Policy | `PolicyV1`, `SodConstraintV1`, `PolicyInlineRuleV1` | `schemaVersion=1`; valid SoD constraint variants; valid rule effects (`Allow|Deny`); required workspace and creator IDs. |
| AdapterRegistration | `AdapterRegistrationV1` | `schemaVersion=1`; non-empty `capabilityMatrix`; capability-family compatibility; strict execution policy (`PerTenantWorker`, `capabilityMatrix`, `sandboxVerified=true`, https egress). |
| WorkItem | `WorkItemV1` | `schemaVersion=1`; status in `Open|InProgress|Blocked|Resolved|Closed`; thin object shape enforced (unknown fields rejected); SLA due date must not precede create time. |
| CredentialGrant | `CredentialGrantV1` | `schemaVersion=1`; temporal ordering (`issued <= expires/rotated/revoked` when present); derived status model (`Active|Expired|Revoked|PendingRotation`). |

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
