# Credential Vault Migration Runbook

**Bead:** bead-0672
**Date:** 2026-02-21
**Owner:** Platform Security

## Purpose

This runbook describes how to migrate SoR (System of Record) credentials from
environment variables and config files to HashiCorp Vault KV v2.

## Prerequisites

- Vault cluster deployed and unsealed (HA mode recommended for production)
- KV v2 secrets engine enabled at the configured mount path (default: `secret`)
- Vault policies configured per tenant with least-privilege access
- Kubernetes auth method enabled for workload identity (see ADR-0074)

## Migration phases

### Phase 1: Inventory

1. Enumerate all SoR credentials currently stored as environment variables or
   config values.
2. Record for each credential:
   - Tenant ID
   - Credential name (logical key)
   - Current storage location (env var name, config file path)
   - Adapter that consumes the credential
3. Output: credential inventory spreadsheet / JSON file.

### Phase 2: Vault provisioning

1. For each tenant, create the Vault path prefix:
   ```
   vault kv put secret/data/<tenantId>/<credentialName> value=<secret>
   ```
2. Configure Vault policies to restrict access:
   ```hcl
   path "secret/data/{{identity.entity.aliases.k8s.metadata.tenant_id}}/*" {
     capabilities = ["read"]
   }
   ```
3. Verify read access from the application service account.

### Phase 3: Dual-read migration

1. Update adapters to use `CredentialProviderPort` with fallback to env vars.
2. Deploy and monitor for credential retrieval errors.
3. Confirm all adapters successfully read from Vault (check Vault audit log).

### Phase 4: Env var removal

1. Remove credential values from environment variables and config files.
2. Remove fallback logic from adapters.
3. Rotate all migrated credentials to invalidate the old values.

### Phase 5: Validation

1. Verify no env-var-based credential access remains (grep for removed env var names).
2. Confirm Vault audit log shows all expected access patterns.
3. Run integration test suite to validate end-to-end credential retrieval.

## Rollback

- Re-deploy the previous version with env-var-based credential access.
- Vault credentials remain intact; no data loss.

## Monitoring

- Alert on `CredentialProviderUnavailable` errors (Vault connectivity).
- Alert on `CredentialAccessDenied` errors (policy misconfiguration).
- Dashboard: credential retrieval latency (p50, p95, p99) per tenant.
