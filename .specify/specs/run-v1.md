# Run v1 (Workflow Execution Instance)

## Purpose

A Run is a single execution instance of a Workflow. It is the control-plane object that tracks status, timing, tier, and correlation for evidence/events.

This schema is aligned with the Run aggregate in `docs/domain/aggregates.md`.

## Schema (RunV1)

Fields:

- `schemaVersion`: `1`
- `runId`: branded `RunId`
- `workspaceId`: branded `WorkspaceId`
- `workflowId`: branded `WorkflowId`
- `correlationId`: branded `CorrelationId`
- `executionTier`: `ExecutionTier`
- `initiatedByUserId`: branded `UserId`
- `status`: `RunStatus`
- `createdAtIso`: ISO-8601/RFC3339 UTC timestamp string
- `startedAtIso?`: ISO-8601/RFC3339 UTC timestamp string (optional)
- `endedAtIso?`: ISO-8601/RFC3339 UTC timestamp string (optional)

### RunStatus

One of:

- `Pending`
- `Running`
- `WaitingForApproval`
- `Paused`
- `Succeeded`
- `Failed`
- `Cancelled`
