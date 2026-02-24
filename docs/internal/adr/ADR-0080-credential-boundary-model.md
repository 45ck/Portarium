# ADR-0080: Credential Boundary Model for Agentic Workflows

**Status**: Proposed
**Date**: 2026-02-22
**Deciders**: Core team
**Bead**: bead-0754

---

## Context

Agentic workflows in Portarium invoke external systems (ERP, CRM, payment gateways, ML
inference APIs) on behalf of a workspace. Each invocation requires credentials (API keys,
OAuth tokens, mTLS certificates) that must be:

1. **Isolated** — one workspace's credentials must never leak to another workspace.
2. **Audited** — every credential access must appear in the evidence chain.
3. **Scoped** — an agent machine should only access credentials it was explicitly granted.
4. **Rotatable** — credentials must be replaceable without stopping workflows in flight.
5. **Portable** — the model must work in local dev, staging, and production without
   code changes.

---

## Decision

We adopt a **secret-reference model** where agent machines and workflow steps reference
credentials by a stable logical name (`secretRef`) rather than embedding credential
values. The actual secret value is resolved at runtime by a **Credential Store adapter**.

### Credential boundary layers

```
┌─────────────────────────────────────────────────────┐
│  Workflow definition                                 │
│  (committed to git, no secrets)                     │
│                                                      │
│  step:                                              │
│    adapter: odoo-crm                                │
│    secretRef: grants/odoo-prod-token   ← logical ref │
└────────────────────┬────────────────────────────────┘
                     │ resolved at runtime
                     ▼
┌─────────────────────────────────────────────────────┐
│  Credential Store (pluggable)                       │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │  Local dev   │  │  Production  │                 │
│  │  .env / file │  │  Vault / K8s │                 │
│  │  secret      │  │  secrets     │                 │
│  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────┘
                     │ injected into
                     ▼
┌─────────────────────────────────────────────────────┐
│  MisAdapterV1.invoke(operation, payload, ctx)       │
│  ctx.credentials: { [secretRef]: string }           │
│  (never logged, never stored in evidence)           │
└─────────────────────────────────────────────────────┘
```

### Credential Store interface

```typescript
// src/infrastructure/credentials/credential-store.ts
export interface CredentialStore {
  /**
   * Resolve a secretRef to its current value.
   * Throws CredentialNotFoundError if the ref is not provisioned.
   * Throws CredentialAccessDeniedError if the workspaceId lacks permission.
   */
  resolve(
    secretRef: string,
    context: { workspaceId: string; runId: string; agentMachineId: string },
  ): Promise<string>;
}
```

### Implementations

| Environment    | Implementation                                                      | Notes                                               |
| -------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| Local dev      | `EnvCredentialStore` — reads `process.env`                          | `grants/odoo-prod-token` → `GRANTS_ODOO_PROD_TOKEN` |
| CI             | `EnvCredentialStore` — injected via GitHub secrets                  | Same as local                                       |
| Staging / Prod | `VaultCredentialStore` — HashiCorp Vault KV v2                      | Path: `secret/workspaces/:wsId/:secretRef`          |
| Kubernetes     | `K8sSecretCredentialStore` — Kubernetes Secrets + projected volumes | Secret name: sanitised secretRef                    |

---

## Boundary rules

### Rule 1: No credential values in evidence

The `EvidenceEntryV1` payload **must never** contain credential values.
The orchestration layer is responsible for stripping credentials before evidence emission.

Enforced by:

- `src/application/evidence-emitter.ts` — allowlist of safe payload fields
- Dependency-cruiser rule: `src/domain/` cannot import `src/infrastructure/credentials/`

### Rule 2: SecretRef naming convention

`secretRef` must follow the pattern `grants/<logical-name>`:

- `grants/odoo-prod-token`
- `grants/stripe-api-key`
- `grants/keycloak-client-secret`

This namespace prevents collision with other identifiers and makes grep audits easy.

### Rule 3: Scope gate

The `MachineRegistrationV1.authConfig.secretRef` (the machine's own identity credential)
is distinct from the `secretRef` values in workflow steps (third-party system credentials).

- Machine identity: resolved once at agent startup
- Step credentials: resolved per-invocation, per-workspace

### Rule 4: Egress + credential coupling

A machine may only use credentials for domains present in its `egressAllowlist`.
The orchestration layer enforces this before dispatching to `MisAdapterV1.invoke()`.

---

## Consequences

**Positive**:

- Workflow definitions are credential-free → safe to commit to git
- Credential rotation requires only updating the Credential Store, not redeploying workflows
- Local dev and production use the same code path (just different `CredentialStore` impls)
- Evidence chain is clean — no accidental token leakage

**Negative**:

- Adds a `CredentialStore` abstraction layer (small implementation cost)
- Local dev must set environment variables for each `secretRef` used in seed data
  (documented in `docs/how-to/first-run-local-integrations.md`)

---

## Implementation notes

1. `src/infrastructure/credentials/env-credential-store.ts` — MVP implementation
2. `src/infrastructure/credentials/vault-credential-store.ts` — production implementation
3. `src/application/orchestration/credential-resolver.ts` — resolves refs before dispatch
4. Add `ctx.credentials` to `MisInvocationContext` (update `src/sdk/mis-v1.ts`)

---

## Related

- ADR-0070: Hybrid architecture boundary (orchestration + CloudEvents)
- `src/sdk/mis-v1.ts` — MIS adapter interface
- `src/domain/machine-registration/machine-registration-v1.ts` — `authConfig.secretRef`
- bead-0755: Supply-chain guardrails (dependency scanning for credential libraries)
