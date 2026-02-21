# Migration Phase 4: Enforcement Contract v1

**Beads:** bead-0654 (bead-0693 original reference)

## Purpose

Define the contract for migration phase 4 (enforcement), which enables deny-by-default
controls so that agents cannot bypass the Portarium control plane.

## Scope

- Deny-by-default egress network policy for agent runtimes
- SPIRE mTLS for service-to-service communication
- Tool allowlists per workspace with deny-by-default
- OpenFGA resource-level authorization on all endpoints
- Zero-bypass validation and alerting

## Contract

### Egress policy

- Agent pods can only reach: control plane (443), gRPC (50051), DNS (53), OTel (4317)
- All other outbound traffic denied

### SPIRE identity convention

```
spiffe://portarium.io/ns/{namespace}/sa/{service-account}
```

### Tool allowlist schema

```json
{
  "workspaceId": "string",
  "allowedTools": [{ "tool": "string", "tier": "ExecutionTier" }],
  "defaultAction": "Deny"
}
```

### OpenFGA relations

- `workspace:{id}#member` for workspace access
- `run:{id}#operator` for run lifecycle
- `approval:{id}#approver` for approval decisions
- `agent:{id}#owner` for agent management

### Enforcement target

- `portarium_direct_sor_ratio` = 0.0 (zero direct SoR calls)

### Alerting

- Direct SoR call detected: Critical
- mTLS handshake failure spike: Warning
- Policy bypass attempt: Critical
- Tool allowlist violation: Warning

## Acceptance Criteria

1. Runbook published at `docs/governance/migration-phase-4-enforcement.md`
2. Egress network policy template documented
3. SPIRE identity convention defined
4. Tool allowlist schema defined with deny-by-default
5. OpenFGA relation model documented
6. Staged rollback procedure documented (3 levels + full)
