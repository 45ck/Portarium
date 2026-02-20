# Migration Phase 2: Credential Relocation Runbook

**Beads:** bead-0652 (bead-0691 original reference)
**Status:** Draft
**Date:** 2026-02-21
**Prerequisites:** Phase 1 (Visibility) complete

## Objective

Move all SoR provider credentials (API keys, OAuth tokens, service account keys) from
agent runtimes into Portarium-managed Vault storage. After this phase, agents authenticate
only with workspace-scoped Portarium JWTs -- they never hold SoR secrets directly.

## Success Criteria

- Zero SoR credentials stored in agent runtime environments
- All SoR credentials stored in Vault with workspace-scoped access policies
- Agents use Portarium-issued JWTs for all control-plane interactions
- Credential rotation automated via Vault TTL policies
- `portarium_direct_sor_ratio` metric decreases (agents still call SoRs directly,
  but credentials are retrieved through Portarium)

## Runbook Steps

### Step 1: Audit current credential storage

1. Scan agent runtimes for embedded credentials:
   - Environment variables (`*_API_KEY`, `*_SECRET`, `*_TOKEN`)
   - Configuration files (`.env`, `config.yaml`, `secrets.json`)
   - Hardcoded values in source code (use `trufflehog` or `gitleaks`)
2. For each credential, record: SoR provider, auth type (API key, OAuth2, service account),
   rotation frequency, number of agents sharing the credential
3. Classify by risk: High (financial SoR, PII access), Medium (operational SoR), Low (read-only)

**Verification:** Credential audit spreadsheet published; all credentials inventoried.

### Step 2: Provision Vault secrets engine

1. Enable KV v2 secrets engine at `portarium/credentials/`
2. Create workspace-scoped policies:
   ```hcl
   path "portarium/credentials/data/{{identity.entity.metadata.workspace_id}}/*" {
     capabilities = ["read"]
   }
   ```
3. Configure Vault auth method for Portarium execution-plane workers
4. Set TTL policies per credential type:
   - API keys: 90-day rotation
   - OAuth2 refresh tokens: 30-day rotation
   - Service account keys: 180-day rotation

**Verification:** Vault secrets engine accessible; workspace-scoped policies enforced.

### Step 3: Migrate credentials to Vault

For each SoR credential:

1. Write credential to Vault:
   ```bash
   vault kv put portarium/credentials/data/{workspaceId}/{provider} \
     api_key="{value}" \
     auth_type="api_key" \
     provider="{provider_name}"
   ```
2. Create a Portarium `CredentialGrant` record linking the Vault path to the workspace
3. Verify the credential is readable through Portarium's credential retrieval API
4. Remove the credential from the agent runtime environment
5. Verify the agent can no longer access the SoR directly (expect auth failure)

**Verification:** Agent cannot call SoR without Portarium-mediated credential retrieval.

### Step 4: Issue Portarium JWTs to agents

1. Register each agent in Portarium workspace:
   ```bash
   portarium agent register --name "sales-bot-01" --workspace ws-acme
   ```
2. Agent receives a workspace-scoped JWT with claims:
   ```json
   {
     "sub": "agent:sales-bot-01",
     "workspace_id": "ws-acme",
     "roles": ["operator"],
     "iat": 1740000000,
     "exp": 1740003600
   }
   ```
3. Configure agent to use JWT for all Portarium API calls
4. Configure agent to request SoR credentials through Portarium credential retrieval API

**Verification:** Agent authenticates with JWT; SoR credentials retrieved via Portarium.

### Step 5: Validate credential rotation

1. Trigger a manual rotation for one credential
2. Verify agents automatically receive the new credential on next retrieval
3. Verify the old credential is revoked
4. Enable automated rotation via Vault TTL policies

**Verification:** Credential rotation completes without agent downtime.

## Rollback

If credential relocation causes operational issues:

1. Re-inject SoR credentials into agent runtime environment variables
2. Agents fall back to direct SoR access (phase 1 logging still active)
3. Vault credentials remain in place for future migration attempt

**Risk:** Brief downtime during rollback while credentials are re-injected.

## Duration Estimate

3-6 weeks depending on number of SoR integrations and credential types.

## Next Phase

Phase 3: Routing by Default -- deploy SDK/MCP/OpenClaw hooks so agents route through
Portarium for actual SoR interactions.
