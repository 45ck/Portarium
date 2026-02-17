# Policy v1 (SoD Constraints)

## Purpose

Policies define what can run, under what constraints, and with what required human controls.

This spec covers the initial set of **Separation of Duties (SoD)** primitives from ADR-0031.

## Semantics

- SoD constraints are evaluated across the lifecycle of a workflow Run (cross-step), not per action in isolation.
- Violations are intended to produce audit/evidence entries (category `Policy`) and block or route approvals accordingly.

## Schema (PolicyV1)

Fields:

- `schemaVersion`: `1`
- `policyId`: branded `PolicyId`
- `workspaceId`: branded `WorkspaceId`
- `createdAtIso`: ISO-8601/RFC3339 UTC timestamp string
- `createdByUserId`: branded `UserId`
- `sodConstraints?`: `SodConstraintV1[]` (optional; may be empty)

### SodConstraintV1

Discriminated union by `kind`:

#### MakerChecker

The Run initiator (maker) cannot also be an approver (checker).

- `kind`: `MakerChecker`

#### DistinctApprovers

Requires at least N distinct human approvers.

- `kind`: `DistinctApprovers`
- `minimumApprovers`: integer `>= 1`

#### IncompatibleDuties

Declares that a single actor cannot perform more than one duty from a declared incompatible set.

- `kind`: `IncompatibleDuties`
- `dutyKeys`: `string[]` (non-empty strings; length `>= 2`)

Notes:

- Duty keys are stable identifiers for duties (e.g. action kinds, capability keys) chosen by the workflow/policy layer.
