# Control-Plane Agent-Routing Enforcement Contract v1

**Beads:** bead-0648

## Purpose

Define a testable contract that ensures agents, robots, and automation entry points route
external-effecting work through Portarium control-plane boundaries.

## Scope

This contract governs:

- authentication and identity requirements for agent-originated calls,
- mandatory control-plane endpoint usage,
- evidence capture obligations,
- CloudEvents emission obligations,
- error semantics for routing and enforcement failures.

## Required Auth Flows

### 1. Agent workload identity

- Agents must authenticate using short-lived Portarium-issued identity tokens.
- Tokens must be workspace scoped and include a subject identity.
- Long-lived System-of-Record credentials must not be present in agent runtime config.

### 2. Control-plane delegated execution

- Any SoR action request from an agent must be sent to Portarium control-plane endpoints.
- Execution-plane workers retrieve SoR credentials through Portarium-managed secret paths.
- Agents must not receive raw SoR secrets in request/response payloads.

### 3. Identity-to-route binding

- Control-plane handlers must verify token workspace scope matches `{workspaceId}` route params.
- Workspace mismatch must fail closed.

## Mandatory Control-Plane Endpoints

Agent-driven workflows and governance operations must use control-plane API paths (no direct
SoR routing), including at minimum:

- Run lifecycle:
  - `POST /v1/workspaces/{workspaceId}/runs`
  - `GET /v1/workspaces/{workspaceId}/runs/{runId}`
  - `POST /v1/workspaces/{workspaceId}/runs/{runId}/cancel`
- Approval lifecycle:
  - `GET /v1/workspaces/{workspaceId}/approvals`
  - `POST /v1/workspaces/{workspaceId}/approvals/{approvalId}/decide`
- Evidence surfaces:
  - `GET /v1/workspaces/{workspaceId}/evidence`
  - `GET /v1/workspaces/{workspaceId}/runs/{runId}/evidence`
- Agent registration and validation:
  - `GET /v1/workspaces/{workspaceId}/agents`
  - `POST /v1/workspaces/{workspaceId}/agents`
  - `PATCH /v1/workspaces/{workspaceId}/agents/{agentId}`
  - `POST /v1/workspaces/{workspaceId}/agents/{agentId}/test`
- Credential governance:
  - `POST /v1/workspaces/{workspaceId}/credential-grants`
  - `POST /v1/workspaces/{workspaceId}/credential-grants/{credentialGrantId}/rotate`
  - `POST /v1/workspaces/{workspaceId}/credential-grants/{credentialGrantId}/revoke`

Direct agent-to-SoR endpoint calls are non-compliant with this contract.

## Evidence Capture Rules

For each routed agent action lifecycle event (`ActionDispatched`, `ActionCompleted`,
`ActionFailed`):

- persist immutable payload evidence in WORM-compatible storage,
- append evidence metadata with `workspaceId`, `runId`, `actionId`, and `correlationId`,
- include route-context metadata (control-plane endpoint class and decision path),
- preserve hash-chain continuity through evidence append semantics.

Routing denials and policy-blocked attempts must also generate auditable evidence entries.

## Event Emission Obligations

Each agent lifecycle event must emit one CloudEvent envelope via outbox/event publisher with:

- `source: portarium.control-plane.agent-runtime`,
- `type` values:
  - `com.portarium.agent.ActionDispatched`,
  - `com.portarium.agent.ActionCompleted`,
  - `com.portarium.agent.ActionFailed`,
- required attributes:
  - `tenantid`,
  - `runid`,
  - `actionid`,
  - `correlationid`.

Emission must remain asynchronous and not bypass orchestration correctness authority.

## Error Semantics

Routing enforcement and contract violations must return RFC 9457 `application/problem+json`
responses with stable classification:

- `401` `unauthenticated`: missing/invalid/expired Portarium identity.
- `403` `forbidden`: identity lacks required workspace/role scope.
- `409` `policy_blocked`: policy denies attempted operation or route.
- `422` `invalid_route_contract`: missing required routing/correlation fields.
- `503` `execution_unavailable`: control-plane cannot reach required execution dependency.

Error responses must include correlation metadata suitable for evidence and event linkage.

## Testable Acceptance Criteria

1. Auth enforcement tests prove expired or workspace-mismatched tokens are rejected.
2. Contract tests prove direct SoR endpoint routing attempts are blocked.
3. Lifecycle tests prove each routed agent action appends evidence on dispatch/completion/failure.
4. Event tests prove required CloudEvent types/attributes emit for each lifecycle event.
5. Error-contract tests prove RFC 9457 envelopes and status-class mappings above.
