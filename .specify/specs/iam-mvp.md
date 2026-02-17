# IAM MVP (Workspace AuthN + RBAC)

## Purpose

Provide a minimal authentication and authorization baseline for the control plane:

- OIDC-authenticated users map to a workspace-scoped actor
- Workspace users carry one or more `WorkspaceUserRole` values
- Authorization is enforced at action boundaries (admin/operator/approver/auditor separation)

## Authentication Claims

Application servers should materialize a `WorkspaceActor` from trusted token claims with:

- `sub`: workspace user identifier (`UserId`)
- `workspaceId`: tenant/workspace identifier (`WorkspaceId`)
- `roles`: non-empty `WorkspaceUserRole[]` with no duplicates

Invalid claim payloads are rejected with `WorkspaceAuthClaimParseError`.

## Authorization

Authorization is enforced by action-level guard helpers in `application/iam/rbac`.

- `WorkspaceAuthorizationError` is thrown when the actor lacks required role
- `assertCanPerformWorkspaceAction` provides a single enforcement entrypoint

## Action Matrix (v1)

- `manageWorkspaceUsers`, `manageWorkspace`, `createWorkspace`, `managePolicies` → `admin`
- `manageWorkflows`, `startRun`, `decideApprovals` → `admin`, `operator` (for decide approvals: `admin`, `approver`)
- `listWorkflows`, `listRuns`, `listApprovals`, `readEvidence`, `readPolicies`, `readWorkspace` → all roles

Read-more detail should track with API-level endpoint-to-role mapping in `control-plane-api-v1.md`.
