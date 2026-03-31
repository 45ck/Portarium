# Portarium Governance Protocol

This document specifies the HTTP contract between the `@portarium/openclaw-plugin` and the
Portarium control plane. All endpoints are under `/v1/workspaces/:wsId/`.

---

## Authentication

Every request must carry:

```
Authorization: Bearer <bearerToken>
x-portarium-tenant-id: <tenantId>
x-portarium-workspace-id: <workspaceId>
Content-Type: application/json   (POST requests only)
```

The `bearerToken` is the _agent_ token. It identifies the proposer for maker-checker enforcement.
Operator decisions must use a _different_ token (the operator token) — the control plane rejects
self-approval with HTTP 403.

---

## Endpoints

### 1. Propose action

```
POST /v1/workspaces/:wsId/agent-actions:propose
```

Submits a proposed tool call for policy evaluation.

**Request body:**

```jsonc
{
  "agentId": "agent:main:main", // required — identifies the proposing agent
  "actionKind": "tool_call", // always "tool_call" from the plugin
  "toolName": "exec", // the tool name being proposed
  "parameters": { "cmd": "ls -la" }, // tool parameters (arbitrary JSON object)
  "rationale": "Agent tool call: exec (session: agent:main:main)", // human-readable description
  "policyIds": ["default-governance"], // policy IDs to evaluate against
  "executionTier": "HumanApprove", // tier hint: Auto | Assisted | HumanApprove | ManualOnly
  "correlationId": "run-abc123", // optional — links to an agent run
}
```

**Response — Allow (HTTP 200 or 202):**

```json
{ "decision": "Allow", "proposalId": "prop-uuid" }
```

**Response — NeedsApproval (HTTP 202):**

```json
{
  "decision": "NeedsApproval",
  "proposalId": "prop-uuid",
  "approvalId": "appr-uuid",
  "evidenceId": "evid-uuid"
}
```

The `evidenceId` links this proposal to an immutable audit record in the evidence log.

**Response — Denied (HTTP 409):**

```json
{
  "decision": "Denied",
  "proposalId": "prop-uuid",
  "message": "Policy denied: tool not permitted at this tier"
}
```

**Error responses:**

| Status | Meaning                                      |
| ------ | -------------------------------------------- |
| 400    | Validation error — malformed request body    |
| 401    | Missing or invalid Authorization header      |
| 403    | Token does not have access to this workspace |
| 422    | Unprocessable — e.g. unknown policyId        |
| 5xx    | Control plane internal error                 |

The plugin treats all non-2xx responses except 409 as `status: 'error'`. A 409 is treated as
`status: 'denied'`.

---

### 2. Poll approval status

```
GET /v1/workspaces/:wsId/approvals/:approvalId
```

Returns the current status of an approval record. The plugin polls this endpoint every
`pollIntervalMs` milliseconds (default: 3000ms) until the status transitions out of `Pending`.

**Response (HTTP 200):**

```jsonc
{
  "approvalId": "appr-uuid",
  "toolName": "exec",
  "status": "Pending", // Pending | Approved | Denied | Expired
  "createdAt": "2026-03-31T10:00:00.000Z",
  "reason": null, // present when status is Denied
}
```

**Status transitions:**

```
Pending → Approved   (operator approves)
Pending → Denied     (operator denies)
Pending → Expired    (control plane TTL exceeded — no operator decision)
```

The `Approved` and `Denied` states are terminal. `Expired` is also terminal and is treated as
a denial by the plugin.

**Plugin handling per status:**

| Status   | Plugin action                                                         |
| -------- | --------------------------------------------------------------------- |
| Pending  | Sleep `pollIntervalMs` then poll again                                |
| Approved | Return `{ approved: true }` — tool call proceeds                      |
| Denied   | Return `{ approved: false, reason }` — hook returns `{ block: true }` |
| Expired  | Return `{ approved: false, reason: "Approval expired..." }`           |
| Error    | Log warning, keep polling (transient errors do not abort the wait)    |

**Error responses:**

| Status | Meaning                                        |
| ------ | ---------------------------------------------- |
| 401    | Missing or invalid token                       |
| 403    | Token lacks read access to this approval       |
| 404    | Approval record not found                      |
| 5xx    | Transient control plane error — plugin retries |

---

### 3. Submit approval decision

```
POST /v1/workspaces/:wsId/approvals/:approvalId/decide
```

Used by human operators (or automated systems) to approve or deny a pending action. This
endpoint is **not** called by the plugin — it is called by the cockpit UI or the operator
directly via the API.

**Request body:**

```jsonc
{
  "decision": "Approved", // Approved | Denied
  "reason": "Reviewed and safe", // optional — surfaces to agent on denial
}
```

**Response (HTTP 200):**

```json
{ "approvalId": "appr-uuid", "status": "Approved" }
```

**Error responses:**

| Status | Meaning                                                                   |
| ------ | ------------------------------------------------------------------------- |
| 400    | Invalid decision value                                                    |
| 403    | Maker-checker violation — deciding user is the same as the proposing user |
| 404    | Approval not found                                                        |
| 409    | Approval is not in Pending state (already decided or expired)             |

**Maker-checker note:** The control plane compares the `sub` claim of the Authorization token
against the `agentId` recorded at proposal time. If they match, HTTP 403 is returned with:

```
Maker-checker violation: the deciding user cannot be the same as the requesting user.
```

This is a system-level control — it cannot be bypassed by the agent regardless of how it is
instructed.

---

### 4. List pending approvals (optional, for cockpit / operator tooling)

```
GET /v1/workspaces/:wsId/approvals?status=pending
```

Returns a list of approvals awaiting a decision. The plugin uses this internally for the
`portarium_list_approvals` introspection tool (bypassed from governance).

**Response (HTTP 200):**

```json
{
  "items": [
    {
      "approvalId": "appr-uuid",
      "toolName": "exec",
      "status": "pending",
      "createdAt": "2026-03-31T10:00:00.000Z"
    }
  ]
}
```

---

## Polling semantics

The plugin uses a deadline-based polling loop:

```
deadline = now() + approvalTimeoutMs   (default: 86_400_000ms = 24 hours)

while now() < deadline:
  result = GET /approvals/:id
  if result.status in {Approved, Denied, Expired}: return result
  if result.status == error: log warning, continue   // transient errors don't abort
  sleep(pollIntervalMs)                               // default: 3000ms

return { approved: false, reason: "Approval timed out after 86400000ms" }
```

Key properties:

- Detection latency after an operator decision is at most one `pollIntervalMs` (3s default).
- Transient poll errors are swallowed — the loop continues until timeout.
- Expiry is server-side TTL; the plugin also has a client-side deadline.

---

## Evidence chain

Every `NeedsApproval` response includes an `evidenceId`. This ID references an immutable record
in the evidence log that contains:

- The full tool name and parameters at proposal time
- The `agentId` and `sessionKey`
- The policy evaluation result and which policy IDs were evaluated
- The timestamp of the proposal

This record is not mutable after creation. If the operator later approves or denies, the decision
is recorded separately and linked to the evidence record via `evidenceId`. The chain is:

```
Proposal → Evidence record (immutable)
         → Approval record (Pending → terminal state)
         → Decision record (who decided, when, why)
```

This provides a complete, tamper-evident audit trail for every governed tool call.

---

## Fail-closed vs fail-open

When `POST /agent-actions:propose` fails (network error, timeout, 5xx), the plugin checks
`config.failClosed` (default: `true`):

| `failClosed` | Behaviour on error                                                            |
| ------------ | ----------------------------------------------------------------------------- |
| `true`       | Block the tool call with: "Portarium governance unavailable — failing closed" |
| `false`      | Allow the tool call through with a warning logged                             |

The default is fail-closed (`true`). This means governance failures are safe by default —
the agent cannot act when Portarium is unreachable.

---

## Bypass list

The following tool names are exempt from governance and pass through without a proposal:

- `portarium_get_run`
- `portarium_list_approvals`
- `portarium_capability_lookup`

These are Portarium's own introspection tools. Governing them would create a circular dependency
(the plugin would need to propose before it could poll for approvals).
