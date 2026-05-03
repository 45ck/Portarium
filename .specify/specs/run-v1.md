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
- `runCharter?`: typed `RunCharterV1` authority envelope attached to governed Runs

### RunStatus

One of:

- `Pending`
- `Running`
- `WaitingForApproval`
- `Paused`
- `Succeeded`
- `Failed`
- `Cancelled`

## Run Charter (RunCharterV1)

A Run charter is the immutable delegated-authority envelope for a governed Run.
It records the charter ID, version, Run goal, success condition, scope boundary, allowed Action
classes, blocked Action classes, budget caps, time window, evidence depth, and
escalation triggers.

The charter also declares the explicit authority boundary:

- `localDecisionActionClasses`: Action classes the Run may decide locally inside
  the charter.
- `approvalGateActionClasses`: Action classes that must pause at an Approval
  Gate.
- `interventionActionClasses`: Action classes that require operator
  intervention before continuing.

Charters are expanded from the delegated-autonomy hierarchy layers
`PlatformBaseline -> Tenant -> Workspace -> RoleOrQueue -> RunCharter`. Lower
layers may tighten constraints. Attempts to expand allowed Action classes,
remove blocked classes, raise budget caps, widen time windows, reduce evidence
depth, or move Approval Gate/intervention classes into local decisions are
recorded as blocked weakening attempts and must not silently change the
effective charter.

Every expansion produces immutable diff evidence: source layer refs, field-level
diffs, blocked weakening attempts, a canonical charter hash, and a
Cockpit-readable summary for Run detail and Approval Gate surfaces.
