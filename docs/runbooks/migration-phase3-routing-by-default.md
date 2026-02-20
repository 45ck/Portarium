# Migration Phase 3: Routing by Default

**Bead:** bead-0692
**Date:** 2026-02-21

## Objective

Make the Portarium SDK and MCP server the default integration path for all
agent-to-SoR communication. After this phase, agents use `client.runs.start()`
for all SoR interactions, and the OpenClaw hook blocks unrouted calls.

## Prerequisites

- [ ] Phase 2 (Credential Relocation) complete -- agents have no direct SoR
      credentials.
- [ ] Portarium SDK (`PortariumClient`) deployed to all agent environments.
- [ ] MCP server template configured for MCP-based agents.
- [ ] OpenClaw hook available (`examples/openclaw-hook/`).
- [ ] Routing compliance baseline from Phase 1 dashboard.

## Deployment guide

### 1. Deploy Portarium SDK to all agents

Install the SDK in each agent's runtime:

```bash
npm install @portarium/sdk
```

Update agent code to use the SDK:

```typescript
import { PortariumClient } from '@portarium/sdk';

const client = new PortariumClient({
  baseUrl: 'https://api.portarium.example.com',
  workspaceId: 'ws-production',
  // Token is fetched from Vault or injected by the platform.
});

// Instead of direct SoR calls:
const run = await client.runs.start({
  workflowId: 'wf-create-invoice',
  inputPayload: { amount: 1000, currency: 'USD' },
});
```

### 2. Deploy MCP server for MCP-based agents

For agents using the Model Context Protocol:

```bash
# Configure in claude_desktop_config.json or equivalent
{
  "mcpServers": {
    "portarium": {
      "command": "npx",
      "args": ["tsx", "examples/mcp-server/server.ts"],
      "env": {
        "PORTARIUM_BASE_URL": "https://api.portarium.example.com",
        "PORTARIUM_TOKEN": "<service-token>"
      }
    }
  }
}
```

### 3. Enable OpenClaw hook in enforce mode

Update the OpenClaw workspace configuration:

```yaml
hooks:
  pre_tool_call:
    - type: script
      path: ./openclaw-hook/hook.ts
      env:
        PORTARIUM_BASE_URL: https://api.portarium.example.com
        PORTARIUM_ENFORCE: "true"
        PORTARIUM_ALLOWLIST: "read_file,list_directory,search_code"
```

### 4. Gradual rollout

Roll out in stages to minimize risk:

| Stage | Scope              | Duration  | Enforce? | Criteria to advance          |
| ----- | ------------------ | --------- | -------- | ---------------------------- |
| 1     | Dev workspace      | 1 week    | Yes      | Zero direct SoR calls        |
| 2     | Staging workspace  | 1 week    | Yes      | All workflows pass           |
| 3     | 10% production     | 1 week    | Yes      | Compliance > 95%             |
| 4     | 50% production     | 1 week    | Yes      | No regressions               |
| 5     | 100% production    | --        | Yes      | Full routing compliance      |

## OpenClaw hook configuration guide

### Basic enforcement

```bash
# Block all non-Portarium tool calls
PORTARIUM_ENFORCE=true
PORTARIUM_ALLOWLIST=""
```

### With read-only allowlist

```bash
# Allow read-only tools that don't mutate SoR state
PORTARIUM_ENFORCE=true
PORTARIUM_ALLOWLIST=read_file,list_directory,search_code,get_weather
```

### Audit-only (for testing)

```bash
# Log but don't block (use during initial rollout)
PORTARIUM_ENFORCE=false
```

## Metrics for measuring routing compliance

### Target: >90% routing compliance

| Metric                            | Source                              | Target |
| --------------------------------- | ----------------------------------- | ------ |
| Routing compliance %              | Side-effect logger                  | > 90%  |
| Direct SoR calls per hour         | Log aggregation                     | < 10   |
| Hook block rate                   | OpenClaw hook logs                  | < 5%   |
| SDK adoption (agents using SDK)   | Agent inventory                     | 100%   |
| MCP server adoption               | Agent inventory (MCP agents)        | 100%   |

### Dashboard queries

```
# Routing compliance over time (Prometheus/Grafana)
sum(rate(portarium_calls_total{classification="control-plane-routed"}[1h]))
/
sum(rate(portarium_calls_total[1h]))
* 100

# Direct SoR calls by endpoint
topk(10, sum by (url) (rate(portarium_calls_total{classification="direct-sor-call"}[1h])))

# Hook blocks
sum(rate(openclaw_hook_blocks_total[1h]))
```

### Alerting

| Alert                            | Threshold              | Severity |
| -------------------------------- | ---------------------- | -------- |
| Compliance below 90%             | < 90% over 1h         | Warning  |
| Compliance below 80%             | < 80% over 1h         | Critical |
| New direct SoR endpoint detected | Any new URL pattern    | Warning  |
| Hook block rate spike            | > 20% over 15m        | Warning  |

## Validation

- [ ] All agents use Portarium SDK or MCP server for SoR interactions.
- [ ] OpenClaw hook blocks unrouted calls in enforce mode.
- [ ] Routing compliance dashboard shows > 90%.
- [ ] All existing workflows pass end-to-end tests.
- [ ] No agent holds direct SoR credentials.

## Rollback

1. Set `PORTARIUM_ENFORCE=false` in the OpenClaw hook (immediate, seconds).
2. Agents fall back to audit-only mode.
3. If SDK issues, agents can temporarily use direct SoR calls (requires
   re-adding credentials from Phase 2 backup).

## Next phase

After routing compliance exceeds 90%, proceed to
**Phase 4: Enforcement** (`migration-phase4-enforcement.md`).
