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

## Escalation and Expiry (bead-0910)

### Escalation Chain

An approval may optionally include an `escalationChain` — an ordered list of escalation steps. Each step specifies a user to escalate to and the number of hours after the request before that step activates.

When the approval scheduler evaluates a pending approval:

1. It computes elapsed hours since `requestedAtIso`.
2. It determines the highest active escalation step (where `elapsedHours >= step.afterHours`).
3. If the active step has changed since the last evaluation, an `ApprovalEscalated` domain event is emitted.

### Expiry

An approval expires when:

1. All escalation steps have been triggered (fully escalated), AND
2. A grace period of 4 hours has passed since the final escalation step's deadline.

When an approval expires, an `ApprovalExpired` domain event is emitted.

### Domain Events

- `ApprovalEscalated` — payload: `{ approvalId, stepIndex, escalateToUserId, elapsedHours }`
- `ApprovalExpired` — payload: `{ approvalId, reason, expiredAtIso }`

### Idempotency

The scheduler tracks the last-observed escalation step per approval in memory. Re-evaluating an approval at the same escalation level does not re-emit events. This prevents duplicate notifications across scheduler sweeps.

### Scheduler Configuration

The approval scheduler runs as a periodic task within the control plane process:

- Default interval: 60 seconds (configurable via `PORTARIUM_APPROVAL_SCHEDULER_INTERVAL_MS`)
- Requires `PORTARIUM_SYSTEM_WORKSPACE_ID` to be set
- Can be disabled via `PORTARIUM_APPROVAL_SCHEDULER_DISABLED=true`
- Gracefully stops on server shutdown (SIGINT/SIGTERM)
