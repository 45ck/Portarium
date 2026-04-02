# Portarium Governance via OpenClaw Plugin — Example

This directory documents the integration between **OpenClaw** (personal AI agent CLI) and the
**Portarium** governance control plane via the `@portarium/openclaw-plugin` package.

The goal: prove that an OpenClaw agent is **policy-confined** — every tool call routes through
Portarium, requires human approval when policy demands it, and cannot bypass governance even if
instructed to do so.

## Contents

| File / Directory        | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| `setup.md`              | Full workspace/OpenClaw setup instructions               |
| `workspace-config.json` | Annotated OpenClaw profile configuration (portarium-dev) |
| `experiments.md`        | Scientific methodology and experiment definitions        |
| `findings.md`           | Results and analysis from running experiments            |
| `results/`              | Raw experiment artefacts (JSON outcomes, logs)           |

## Quick start

```bash
# 1. Start the Portarium control plane (in-memory / dev mode)
DEV_STUB_STORES=true NODE_ENV=development ENABLE_DEV_AUTH=true \
  PORTARIUM_DEV_TOKEN=dev-token PORTARIUM_DEV_USER_ID=agent-proposer \
  PORTARIUM_DEV_TOKEN_2=dev-token-operator PORTARIUM_DEV_USER_ID_2=human-operator \
  PORTARIUM_DEV_WORKSPACE_ID=ws-experiment \
  PORTARIUM_HTTP_PORT=3000 PORTARIUM_APPROVAL_SCHEDULER_DISABLED=true \
  node node_modules/tsx/dist/cli.mjs src/presentation/runtime/control-plane.ts &

# 2. Run the automated governance experiment
PORTARIUM_URL=http://localhost:3000 PORTARIUM_WORKSPACE_ID=ws-experiment \
  PORTARIUM_BEARER_TOKEN=dev-token PORTARIUM_OPERATOR_TOKEN=dev-token-operator \
  PORTARIUM_TENANT_ID=default \
  node node_modules/tsx/dist/cli.mjs experiments/openclaw-governance/run.mjs

# 3. Run a live agent (will suspend on first tool call)
OPENCLAW_CONFIG_PATH="C:/Users/<YOU>/.openclaw-portarium-dev/openclaw.json" \
  openclaw agent --local --session-id portarium-test \
  --message "List files in C:/tmp"

# 4. In another terminal — approve (or deny) the suspended tool call
curl -X POST "http://localhost:3000/v1/workspaces/ws-experiment/approvals/<approvalId>/decide" \
  -H "content-type: application/json" \
  -H "authorization: Bearer dev-token-operator" \
  -H "x-portarium-workspace-id: ws-experiment" \
  -H "x-portarium-tenant-id: default" \
  -d '{"decision": "Approved", "rationale": "Operator approved"}'
```

## Key observations

- Plugin intercepts **every** tool call via `before_tool_call` hook at priority 1000.
- Tool calls that require approval cause the agent to **suspend in-place** — it waits
  (up to `approvalTimeoutMs`, default 24 h) without erroring.
- Maker-checker enforcement: the proposing user **cannot** approve their own action.
- `failClosed` controls behaviour when Portarium is unreachable:
  - `true` (production default): agent is **blocked**
  - `false` (development): agent runs with warning logged
- The governance layer is **transparent** to the agent — it does not know the details of
  the policy evaluation, only whether its tool call was allowed or blocked.
