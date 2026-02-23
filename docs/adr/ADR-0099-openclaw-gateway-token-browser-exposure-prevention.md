# ADR-0099 — OpenClaw gateway token handling and browser-exposure prevention

**Status:** Accepted
**Date:** 2026-02-23
**Bead:** bead-0800

---

## Context

The Portarium control plane manages OpenClaw gateway connections. Each machine
registration may carry an `authConfig` field that references the gateway
credential used to authenticate management-plane API calls:

```typescript
authConfig?: {
  kind: 'bearer' | 'apiKey' | 'mtls' | 'none';
  secretRef?: string; // e.g. "grants/cg-1" — path in the credential store
};
```

The `secretRef` is not the credential value itself; it is an opaque reference
path into the Portarium credential store. Exposing this path to browser clients
would reveal:

- Which credential store entries are in use.
- The naming convention of internal grants.

These details are internal infrastructure configuration and must not reach
browser-accessible API responses.

---

## Decision

### 1. `authConfig` is stripped from all GET and LIST machine responses

The presentation handler (`control-plane-handler.machines.ts`) applies
`toMachineApiView()` before serialising any machine record to the HTTP response:

```typescript
function toMachineApiView(
  machine: MachineRegistrationV1,
): Omit<MachineRegistrationV1, 'authConfig'> {
  const { authConfig: _authConfig, ...view } = machine;
  return view;
}
```

This applies to:

| Endpoint                                | Handler              |
| --------------------------------------- | -------------------- |
| `GET /v1/workspaces/{ws}/machines`      | `handleListMachines` |
| `GET /v1/workspaces/{ws}/machines/{id}` | `handleGetMachine`   |

### 2. The actual gateway API token never touches the database

The gateway API token consumed by `OpenClawOperatorManagementBridge` is:

- Injected at process startup from environment / secret mount.
- Stored only in a `readonly #apiToken` private field.
- Never persisted to the database.
- Never included in any query output or HTTP response.

The `secretRef` in `authConfig` is only used at runtime to resolve the token
via the credential store; the token value itself is never stored in the machine
registration record.

### 3. Contract test enforcement

Two HTTP-level integration tests in
`control-plane-handler.machine-agent.contract.test.ts` assert:

- `GET /machines/{id}` for a machine with `authConfig.secretRef` returns a body
  with no `authConfig` key.
- `GET /machines` (list) for machines with `authConfig.secretRef` returns items
  with no `authConfig` key.

These tests guard against regressions where a refactor might re-expose the
field.

---

## Consequences

### Positive

- Credential references are never sent to the browser, eliminating the
  information-disclosure risk.
- Cockpit clients (`MachineAgentClient`) receive clean machine records that
  match the documented `MachineV1` presentation type.
- The stripping is applied once in the handler, so future schema additions to
  `authConfig` (e.g., mTLS client-cert references) are automatically covered.

### Negative / trade-offs

- Admin tooling that legitimately needs to inspect `authConfig` (e.g., a CLI
  or operator dashboard) must use a separate privileged endpoint or retrieve the
  data server-side. This is a deliberate trade-off: the browser-facing API
  carries a stricter contract than the internal API.

### Neutral

- No changes to the domain model or database schema. The `authConfig` field
  continues to be stored and used internally; the stripping happens only at the
  HTTP serialisation boundary.
