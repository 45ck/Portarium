# Migration Phase 3: Routing by Default Runbook

**Beads:** bead-0653 (bead-0692 original reference)
**Status:** Draft
**Date:** 2026-02-21
**Prerequisites:** Phase 2 (Credential Relocation) complete

## Objective

Deploy Portarium SDK, MCP server, and OpenClaw hooks so that agents route external-effecting
work through the Portarium control plane by default. After this phase, >90% of SoR
interactions should flow through Portarium.

## Success Criteria

- Portarium SDK/MCP/OpenClaw hooks deployed to all agent runtimes
- `portarium_direct_sor_ratio` metric drops below 0.10 (>90% routed)
- Policy evaluation active for all routed calls
- Evidence trail captures all routed interactions
- No agent downtime during deployment

## Runbook Steps

### Step 1: Deploy integration SDK per agent type

For each agent runtime, deploy the appropriate integration:

| Agent type              | Integration                | Template                               |
| ----------------------- | -------------------------- | -------------------------------------- |
| OpenAI Agents SDK       | `portarium_tool` decorator | `templates/openai-agents-sdk/`         |
| OpenClaw Gateway        | `before_tool_call` hook    | `templates/openclaw-hook/`             |
| LLM via MCP             | MCP server                 | `templates/mcp-server/`                |
| Custom Python agent     | `portarium-client` SDK     | `docs/sdk/python-client-generation.md` |
| Custom Go agent         | `portarium-go` SDK         | `docs/sdk/go-client-generation.md`     |
| Custom TypeScript agent | `PortariumClient` facade   | TypeScript SDK docs                    |

**Deployment order:**

1. Start with lowest-risk agents (read-only, non-financial SoRs)
2. Progress to medium-risk agents (operational SoRs)
3. End with high-risk agents (financial, PII-handling SoRs)

**Verification:** Each agent's tool calls route through Portarium API.

### Step 2: Configure workspace policies

For each workspace, ensure policies are configured:

1. Define execution tiers per action type:
   - `Auto`: read-only operations, low-risk writes
   - `Assisted`: standard writes with audit trail
   - `HumanApprove`: high-value or sensitive operations
   - `ManualOnly`: critical operations (financial, compliance)

2. Define SoD constraints:
   - Agent that initiates a run cannot approve its own output
   - Financial operations require separate initiator and approver

3. Define tool blast-radius policies:
   - Map each SoR tool to a blast-radius tier
   - Default dangerous tools to `HumanApprove`

**Verification:** Policy evaluation returns correct tier for sample tool calls.

### Step 3: Validate evidence capture

For each routed interaction, verify the evidence trail includes:

- Initiator identity (agent JWT subject)
- Action type and parameters
- Policy evaluation result (tier, decision)
- Approval decision (if applicable)
- Execution result (success/failure)
- Correlation ID linking to parent run
- W3C trace context

**Verification:** Evidence query returns complete chain for sample interactions.

### Step 4: Monitor routing ratio

Deploy or update Grafana dashboard with:

| Panel                        | Query                                                 |
| ---------------------------- | ----------------------------------------------------- |
| Routing ratio (gauge)        | `1 - portarium_direct_sor_ratio{workspace_id="$ws"}`  |
| Routed calls/min (graph)     | `rate(portarium_sor_calls_total{routed="true"}[5m])`  |
| Direct calls/min (graph)     | `rate(portarium_sor_calls_total{routed="false"}[5m])` |
| Policy decisions (pie)       | `portarium_policy_decisions_total` by `decision`      |
| Approval latency (histogram) | `portarium_approval_latency_seconds`                  |

**Target:** `portarium_direct_sor_ratio` < 0.10 within 2 weeks of full deployment.

### Step 5: Address remaining direct calls

For each remaining direct SoR call (`routed=false`):

1. Identify the agent and action from structured logs
2. Determine why routing was bypassed:
   - Missing SDK integration -> deploy SDK
   - SDK bug -> fix and redeploy
   - Intentional bypass -> document exception or block
3. Remediate and verify routing

**Verification:** `portarium_direct_sor_ratio` < 0.10.

## Rollback

If routing causes operational issues:

1. Disable SDK/hook integration per agent (configuration toggle)
2. Agents fall back to direct SoR access using Vault credentials
3. Phase 1 logging continues to capture direct calls

**Risk:** Temporary loss of policy enforcement and evidence capture for rolled-back agents.

## Duration Estimate

4-8 weeks for full deployment across all agents.

## Next Phase

Phase 4: Enforcement -- enable deny-by-default egress, SPIRE mTLS, tool allowlists.
