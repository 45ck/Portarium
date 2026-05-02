# Policy Change Workflow v1

## Purpose

Policy changes are governed domain objects. A policy edit must be versioned, scoped,
attributable, auditable, and reversible before it can influence policy evaluation for Runs.

## Scope

A `PolicyChangeRequestV1` targets one of:

- `Workspace`: all future matching policy decisions in a Workspace.
- `ActionClass`: a named class of Actions inside a Workspace.
- `Tenant`: the broader tenancy boundary.

Every policy change records:

- `policyChangeId`, `policyId`, `workspaceId`
- `operation`: `Create`, `Update`, `Deactivate`, or `Rollback`
- `risk`: `Standard` or `High`
- `status`: `PendingApproval`, `Applied`, `Rejected`, `RolledBack`, or `Superseded`
- `rationale`
- `diff`: non-empty preview of what will change
- `effectiveFromIso` and optional `expiresAtIso`
- `runEffect`: `FutureRunsOnly` or `ActiveAndFutureRuns`
- `proposedByUserId` and `proposedAtIso`
- approval metadata when approval is required

## Approval

High-risk policy changes must require approval. Approval follows maker-checker semantics:
the proposer cannot approve the same policy change. Standard-risk changes may be applied
immediately when `approvalRequired` is false.

## Run Semantics

`FutureRunsOnly` changes do not alter Runs that started before `effectiveFromIso`.
`ActiveAndFutureRuns` changes apply to already active Runs after `effectiveFromIso`.
Expired changes do not apply at or after `expiresAtIso`.

## Audit Trail

Policy change workflow commands append durable audit entries that answer:

- who proposed, approved, applied, rejected, superseded, or rolled back the change
- why the action happened (`rationale`)
- when it happened (`occurredAtIso`)
- which scope and policy version were involved

Policy evidence is emitted under evidence category `Policy` when an evidence log is available.

## Rollback

Rollback is a first-class `Rollback` policy change linked by `rollbackOfPolicyChangeId`.
When the rollback is applied, the target policy change is marked `RolledBack` and links back
through `rolledBackByPolicyChangeId`.
