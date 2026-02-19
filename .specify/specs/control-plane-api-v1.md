# Control Plane API v1 (Workspaces + Users + Work Items)

## Purpose

Define the initial public HTTP contract for Portarium's control plane, starting with Workspace-scoped user management (RBAC) and core schemas (Plan/Evidence) used throughout the product.

This implements ADR-0043 and anchors the OpenAPI contract in `docs/spec/openapi/portarium-control-plane.v1.yaml`.

## Conventions

- **Base path**: `/v1`
- **Tenancy scoping**: all tenant-scoped resources live under `/v1/workspaces/{workspaceId}/...`
- **Errors**: RFC 7807 `application/problem+json`
- **Pagination**: cursor-based (`limit`, `cursor`) returning `nextCursor`
- **Auth**: `Authorization: Bearer <token>` (token semantics are implementation-defined; roles are enforced server-side)

## RBAC Roles (v1)

Workspace User roles are a small, explicit set:

- `admin` — workspace settings + RBAC + credentials + policies
- `operator` — start runs / operate workflows
- `approver` — decide approval gates
- `auditor` — read-only access to runs/evidence (no commands)

## Workspace User (User)

User is a Workspace-scoped entity (see `docs/domain/aggregates.md` invariants):

- `userId`: branded `UserId` (opaque string)
- `workspaceId`: branded `WorkspaceId`
- `email`: unique within workspace
- `displayName?`
- `roles`: non-empty array of roles
- `active`: boolean
- `createdAtIso`: RFC3339 timestamp

## Work Items

Work Items are the universal binding object (ADR-0038). Schema: see `work-item-v1.md`.

Endpoints (v1):

- `GET /v1/workspaces/{workspaceId}/work-items`
- `POST /v1/workspaces/{workspaceId}/work-items`
- `GET /v1/workspaces/{workspaceId}/work-items/{workItemId}`
- `PATCH /v1/workspaces/{workspaceId}/work-items/{workItemId}`

List filtering supports linkage-centric query params:

- `status`, `ownerUserId`
- `runId`, `workflowId`, `approvalId`, `evidenceId`

## Plan / Evidence Schemas

API surfaces reuse versioned payloads:

- Plan v1: see `plan-v1.md`
- Evidence v1: see `evidence-v1.md`
