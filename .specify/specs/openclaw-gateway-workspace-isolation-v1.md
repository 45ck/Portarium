# Spec: OpenClaw Gateway Per-Workspace Isolation Invariants (v1)

**Bead:** bead-0799
**Status:** Accepted

---

## Purpose

This spec codifies the security invariants that prevent one workspace (tenant) from
accessing or mutating another workspace's machines or agents via the OpenClaw gateway
management plane.

---

## Isolation boundaries

### 1. Application-layer tenant check (hard enforcement)

Every gateway-related application command that accepts a `workspaceId` MUST verify
that the supplied `workspaceId` matches `ctx.tenantId` before performing any
side-effecting operation.

Commands that enforce this invariant:

| Command                   | Guard location                                | Error returned                  |
| ------------------------- | --------------------------------------------- | ------------------------------- |
| `syncAgentToGateway`      | `if (wsId !== ctx.tenantId)`                  | `Forbidden` — "Tenant mismatch" |
| `deactivateMachine`       | `if (wsId !== ctx.tenantId)`                  | `Forbidden` — "Tenant mismatch" |
| `registerMachine`         | `ensureTenantMatch(ctx, machine.workspaceId)` | `Forbidden`                     |
| `createAgent`             | `ensureTenantMatch(ctx, agent.workspaceId)`   | `Forbidden`                     |
| `updateAgentCapabilities` | `ensureTenantMatch(ctx, input.workspaceId)`   | `Forbidden`                     |

The check MUST happen after authorization and input validation but **before** any
store or bridge calls.

### 2. Port interface contract

The `OpenClawManagementBridgePort` interface requires a `tenantId` parameter on
every operation. This is a deliberate contract that makes the tenant visible to
all bridge implementations — even if a particular implementation delegates
isolation to the gateway.

```typescript
syncAgentRegistration(tenantId: TenantId, ...): Promise<BridgeOperationResult>;
deregisterAgent(tenantId: TenantId, ...): Promise<BridgeOperationResult>;
getAgentGatewayStatus(tenantId: TenantId, ...): Promise<AgentGatewayStatus>;
```

### 3. Data-layer isolation

The `MachineRegistryStore` uses composite lookup keys `(tenantId, entityId)` for
all reads and writes. A machine or agent record stored under `(workspace-A, machine-1)`
is never visible to a query for `(workspace-B, machine-1)`.

### 4. Operator bridge — tenant routing

`OpenClawOperatorManagementBridge` receives `tenantId` but does not forward it as
an HTTP header. This is intentional: the operator API authenticates via a single
admin bearer token and routes requests by `machineId`/`agentId`, which are globally
unique identifiers assigned at registration time. The application-layer checks above
ensure that only the owning workspace can trigger operations on a given machine or
agent.

If the OpenClaw gateway gains a multi-tenant API that requires per-request tenant
headers, the bridge implementation must be updated to forward the tenant header.

---

## Test coverage requirements

Each application command listed in §1 MUST have at least one test that:

1. Provides an authorized caller (`isAllowed → true`).
2. Supplies a `workspaceId` that does NOT match `ctx.tenantId`.
3. Asserts `result.error.kind === 'Forbidden'`.

This prevents regressions where the tenant check is accidentally removed or
short-circuited.

---

## Non-goals

- This spec does not define gateway-side isolation mechanisms (those are governed by
  the OpenClaw operator API contract).
- This spec does not cover authentication (AuthN) — only workspace scoping (AuthZ).
