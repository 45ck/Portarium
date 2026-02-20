# Migration Phase 2: Credential Relocation

**Bead:** bead-0691
**Date:** 2026-02-21

## Objective

Move all provider secrets (API keys, OAuth tokens, service account credentials)
from agent-local configuration to a centralized Vault instance managed by the
Portarium control plane. After this phase, agents no longer hold SoR credentials
directly.

## Prerequisites

- [ ] Phase 1 (Visibility) complete -- direct SoR call inventory available.
- [ ] HashiCorp Vault deployed and accessible from the control plane.
- [ ] Vault KV v2 secrets engine mounted at `portarium/credentials`.
- [ ] Vault AppRole or Kubernetes auth method configured for the control plane.
- [ ] Backup of all existing agent credential configurations.

## Step-by-step procedure

### 1. Inventory credentials

Using Phase 1 visibility data, compile a list of all SoR endpoints and the
credentials used to access them:

```
| SoR Endpoint                | Credential Type   | Current Location       |
| --------------------------- | ----------------- | ---------------------- |
| erp.example.com             | API key           | agent env ERPNEXT_KEY  |
| stripe.com/v1               | Bearer token      | agent config.yaml      |
| jira.example.com            | OAuth2 client     | agent .env file        |
```

### 2. Create Vault paths

For each credential, create a Vault KV entry under the workspace path:

```bash
vault kv put portarium/credentials/<workspace-id>/<provider-name> \
  api_key=<value> \
  metadata_migrated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  metadata_migrated_from="agent-config"
```

### 3. Configure Vault access policy

Create a Vault policy granting the control plane read access:

```hcl
# portarium-cp-policy.hcl
path "portarium/credentials/{{identity.entity.metadata.workspace_id}}/*" {
  capabilities = ["read"]
}
```

Apply the policy:

```bash
vault policy write portarium-cp portarium-cp-policy.hcl
```

### 4. Update control plane configuration

Configure the control plane to fetch credentials from Vault at runtime:

```yaml
# control-plane config
credentials:
  provider: vault
  vaultAddr: https://vault.internal:8200
  mountPath: portarium/credentials
  authMethod: kubernetes
  role: portarium-control-plane
```

### 5. Remove credentials from agent configs

For each agent:

1. Remove the SoR credential from the agent's environment / config.
2. Verify the agent can no longer call SoR endpoints directly (should fail
   with 401/403).
3. Confirm the agent can still trigger runs through the control plane.

### 6. Validate

Run a test workflow that exercises each SoR integration:

```bash
portarium run start --workflow-id wf-credential-test --workspace ws-production
portarium run status --run-id <id>
```

## Audit checklist

- [ ] All provider credentials identified in Phase 1 inventory.
- [ ] Each credential stored in Vault under the correct workspace path.
- [ ] Vault access policies restrict reads to the control plane service account.
- [ ] Agent configs no longer contain SoR credentials.
- [ ] Control plane successfully retrieves credentials from Vault at runtime.
- [ ] Audit log shows Vault read events for each credential access.
- [ ] No agent can directly authenticate to SoR endpoints.
- [ ] All existing workflows still pass end-to-end tests.

## Rollback procedure

If credential relocation causes production issues:

1. **Immediate:** Re-add credentials to agent configs from the backup taken
   in prerequisites.

2. **Control plane:** Set `credentials.provider: local` to bypass Vault.

3. **Verify:** Run the test workflow to confirm agents can reach SoR endpoints.

4. **Root-cause:** Investigate Vault connectivity, policy, or credential
   format issues before reattempting.

**Rollback timeline:** Credentials can be restored within minutes from backup.
The rollback does not affect Vault state (credentials remain stored for
future migration attempt).

## Next phase

After all credentials are in Vault, proceed to
**Phase 3: Routing by Default** (`migration-phase3-routing-by-default.md`).
