# Approval v1 (Approval Gate Decision)

## Purpose

An Approval represents a single human decision required to proceed past an Approval Gate in a Run.

Approvals sign off on a Plan object (ADR-0027 / ADR-012), not on predictions. This schema is aligned with the Run aggregate in `docs/domain/aggregates.md`.

## Schema (ApprovalV1)

Fields:

- `schemaVersion`: `1`
- `approvalId`: branded `ApprovalId`
- `workspaceId`: branded `WorkspaceId`
- `runId`: branded `RunId`
- `planId`: branded `PlanId`
- `workItemId?`: optional branded `WorkItemId` (when associated with a Work Item)
- `prompt`: human-readable description of what is being approved (one line)
- `requestedAtIso`: ISO-8601/RFC3339 UTC timestamp string
- `requestedByUserId`: branded `UserId`
- `assigneeUserId?`: optional branded `UserId` (unassigned approvals omit this)
- `dueAtIso?`: optional ISO-8601/RFC3339 UTC timestamp string (SLA timer)
- `status`: `ApprovalStatus`

Decision fields (only when `status` is not `Pending`):

- `decidedAtIso`: ISO-8601/RFC3339 UTC timestamp string
- `decidedByUserId`: branded `UserId`
- `rationale`: non-empty string (required)

### ApprovalStatus

One of:

- `Pending`
- `Approved`
- `Denied`
- `RequestChanges`
