# Credential Vault Migration v1

**Status:** Accepted
**Bead:** bead-0672
**Date:** 2026-02-21

## Context

Portarium integrates with multiple Systems of Record (SoR) that require
credentials (API keys, OAuth tokens, mTLS certificates). Storing these in
environment variables or config files is insecure and unauditable. All SoR
credentials must be managed through HashiCorp Vault with tenant-scoped paths.

## Decision

### CredentialProviderPort

Define `CredentialProviderPort` in `src/application/ports/credential-provider.ts`
with a single `getCredential(ref)` method that returns a `Result<CredentialValue, CredentialProviderError>`.

### Vault implementation

`VaultCredentialProvider` in `src/infrastructure/vault/vault-credential-provider.ts`
implements the port using Vault KV v2:

- Secrets stored at `<kvMount>/data/<tenantId>/<credentialName>`
- Version pinning via `?version=N` query parameter
- Tenant isolation enforced at the Vault path level
- Error mapping: 404 -> CredentialNotFound, 403 -> CredentialAccessDenied, other -> CredentialProviderUnavailable

### Credential reference model

| Field            | Type       | Required | Description                           |
| ---------------- | ---------- | -------- | ------------------------------------- |
| `tenantId`       | `TenantId` | Yes      | Workspace/tenant scope                |
| `credentialName` | `string`   | Yes      | Logical name (e.g. `erpnext-api-key`) |
| `version`        | `number`   | No       | Pin to specific version               |

### Credential value model

| Field          | Type     | Description                   |
| -------------- | -------- | ----------------------------- |
| `secret`       | `string` | The resolved secret material  |
| `version`      | `number` | Vault-assigned version number |
| `createdAtIso` | `string` | ISO-8601 creation timestamp   |

## Migration plan

See `docs/internal/governance/credential-vault-migration-runbook.md` for the step-by-step
migration process from environment variables to Vault.

## Consequences

- All adapters retrieve credentials through the port, never from env vars directly.
- Credential rotation is handled by Vault; adapters always fetch the latest version
  unless explicitly pinned.
- Audit trail of credential access is provided by Vault's audit log.
