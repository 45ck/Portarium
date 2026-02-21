# Migration Phase 2: Credential Relocation Contract v1

**Beads:** bead-0652 (bead-0691 original reference)

## Purpose

Define the contract for migration phase 2 (credential relocation), which moves SoR
provider credentials from agent runtimes to Vault and issues Portarium JWTs to agents.

## Scope

- Credential audit and inventory
- Vault secrets engine provisioning with workspace-scoped policies
- Credential migration from agent runtimes to Vault
- Portarium JWT issuance for agent authentication
- Automated credential rotation via Vault TTL

## Contract

### Vault path convention

```
portarium/credentials/data/{workspaceId}/{provider}
```

### Vault policy (workspace-scoped)

- Agents can only read credentials for their own workspace
- Execution-plane workers retrieve credentials on behalf of agents

### JWT claims (agent identity)

- `sub`: `agent:{agentId}`
- `workspace_id`: workspace scope
- `roles`: workspace role assignments
- `exp`: short-lived (1 hour default)

### Credential rotation

- API keys: 90-day TTL
- OAuth2 refresh tokens: 30-day TTL
- Service account keys: 180-day TTL

## Post-conditions

- Zero SoR credentials in agent runtime environments
- All SoR credentials in Vault with workspace-scoped access
- Agents authenticate with Portarium JWTs only

## Acceptance Criteria

1. Runbook published at `docs/governance/migration-phase-2-credential-relocation.md`
2. Vault path convention and policy documented
3. JWT claim schema defined
4. Credential rotation TTLs specified
5. Rollback procedure documented
