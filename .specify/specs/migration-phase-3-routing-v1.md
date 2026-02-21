# Migration Phase 3: Routing by Default Contract v1

**Beads:** bead-0653 (bead-0692 original reference)

## Purpose

Define the contract for migration phase 3 (routing by default), which deploys SDK/MCP/hook
integrations so >90% of SoR interactions flow through the Portarium control plane.

## Scope

- SDK/MCP/hook deployment per agent type
- Workspace policy configuration (execution tiers, SoD, blast-radius)
- Evidence capture validation
- Routing ratio monitoring and remediation

## Contract

### Routing target

- `portarium_direct_sor_ratio` < 0.10 (>90% routed through Portarium)

### Integration matrix

| Agent type        | Integration method         |
| ----------------- | -------------------------- |
| OpenAI Agents SDK | `portarium_tool` decorator |
| OpenClaw Gateway  | `before_tool_call` hook    |
| LLM via MCP       | MCP server tools           |
| Custom Python     | `portarium-client` SDK     |
| Custom Go         | `portarium-go` SDK         |
| Custom TypeScript | `PortariumClient` facade   |

### Evidence chain (per routed interaction)

- Initiator identity (agent JWT `sub`)
- Action type and parameters
- Policy evaluation result
- Approval decision (if applicable)
- Execution result
- Correlation ID
- W3C trace context

### Deployment order

1. Read-only / low-risk agents
2. Operational SoR agents
3. Financial / PII agents

## Acceptance Criteria

1. Runbook published at `docs/governance/migration-phase-3-routing-default.md`
2. Integration matrix documents SDK choice per agent type
3. Routing ratio monitoring dashboard defined
4. Evidence chain requirements specified
5. Rollback procedure documented
