# OpenClaw + Portarium Governance — Setup Guide

## Prerequisites

### 1. OpenClaw

Install the OpenClaw CLI:

```bash
npm install -g openclaw
```

Verify: `openclaw --version`
Tested version: `2026.2.12`

### 2. Portarium repo

Clone and install:

```bash
git clone <repo>
cd portarium
npm install --ignore-scripts
```

### 3. LLM API key

An OpenRouter key is required to run the live agent tests. The plugin tests do not require a
model API key.

---

## OpenClaw profile (portarium-dev)

Create an isolated OpenClaw profile so experiments do not touch your real OpenClaw config:

> **Safety warning:** keep `failClosed` set to `true` for production, shared environments, and
> demos. `failClosed:false` is only for local development when you intentionally accept that an
> unreachable Portarium control plane means tools are no longer governed. The plugin rejects
> `failClosed:false` unless `NODE_ENV` is `development` or `test`.

**File:** `~/.openclaw-portarium-dev/openclaw.json`

```json
{
  "gateway": {
    "mode": "local",
    "port": 19100,
    "auth": { "token": "portarium-dev-token" }
  },
  "models": {
    "providers": {
      "openrouter": {
        "baseUrl": "https://openrouter.ai/api/v1",
        "apiKey": "<YOUR_OPENROUTER_KEY>",
        "api": "openai-responses",
        "models": [
          {
            "id": "anthropic/claude-3-5-haiku",
            "name": "Claude 3.5 Haiku (via OpenRouter)",
            "api": "openai-responses",
            "reasoning": false,
            "input": ["text"],
            "contextWindow": 200000,
            "maxTokens": 8192,
            "cost": { "input": 0.001, "output": 0.005, "cacheRead": 0, "cacheWrite": 0 }
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": { "primary": "openrouter/anthropic/claude-3-5-haiku" },
      "workspace": "<home>/.openclaw-portarium-dev/workspace"
    }
  },
  "plugins": {
    "load": {
      "paths": ["<repo>/packages/openclaw-plugin"]
    },
    "entries": {
      "openclaw-plugin": {
        "enabled": true,
        "config": {
          "portariumUrl": "http://localhost:3000",
          "workspaceId": "ws-experiment",
          "bearerToken": "dev-token",
          "tenantId": "default",
          "failClosed": true,
          "approvalTimeoutMs": 86400000,
          "pollIntervalMs": 3000,
          "defaultPolicyIds": ["default-governance"],
          "defaultExecutionTier": "HumanApprove"
        }
      }
    }
  }
}
```

Key decisions:

- `failClosed: true` — blocks all tool calls if Portarium is unreachable. **This is the safe default.** Set to `false` only for local experimentation where you explicitly want fail-open behaviour; never use `false` in production.
- `defaultExecutionTier: "HumanApprove"` — routes all unknown tools to human approval by default.
- `defaultPolicyIds: ["default-governance"]` — evaluates against the seed policy seeded on startup.

---

## Portarium control plane (dev / in-memory mode)

The control plane can run without Docker or PostgreSQL using in-memory stub stores:

```bash
DEV_STUB_STORES=true \
NODE_ENV=development \
ENABLE_DEV_AUTH=true \
PORTARIUM_DEV_TOKEN=dev-token \
PORTARIUM_DEV_USER_ID=agent-proposer \
PORTARIUM_DEV_TOKEN_2=dev-token-operator \
PORTARIUM_DEV_USER_ID_2=human-operator \
PORTARIUM_DEV_WORKSPACE_ID=ws-experiment \
PORTARIUM_HTTP_PORT=3000 \
PORTARIUM_APPROVAL_SCHEDULER_DISABLED=true \
node node_modules/tsx/dist/cli.mjs src/presentation/runtime/control-plane.ts
```

Verify:

```bash
curl http://localhost:3000/health
# → {"service":"control-plane","status":"ok","startedAt":"..."}
```

### Environment variable reference

| Variable                                | Value                | Purpose                                            |
| --------------------------------------- | -------------------- | -------------------------------------------------- |
| `DEV_STUB_STORES`                       | `true`               | Use in-memory stores (no PostgreSQL needed)        |
| `NODE_ENV`                              | `development`        | Required by the stub store gate                    |
| `ENABLE_DEV_AUTH`                       | `true`               | Enable static bearer token auth                    |
| `PORTARIUM_DEV_TOKEN`                   | `dev-token`          | Agent bearer token (proposer)                      |
| `PORTARIUM_DEV_USER_ID`                 | `agent-proposer`     | User ID for agent token                            |
| `PORTARIUM_DEV_TOKEN_2`                 | `dev-token-operator` | Operator bearer token (approver)                   |
| `PORTARIUM_DEV_USER_ID_2`               | `human-operator`     | User ID for operator token                         |
| `PORTARIUM_DEV_WORKSPACE_ID`            | `ws-experiment`      | Workspace seeded with default policy               |
| `PORTARIUM_HTTP_PORT`                   | `3000`               | HTTP port for the control plane                    |
| `PORTARIUM_APPROVAL_SCHEDULER_DISABLED` | `true`               | Disable expiry sweeps (not needed for experiments) |

### Maker-checker note

Two different tokens (`dev-token` and `dev-token-operator`) are required because Portarium
enforces **maker-checker**: the user who proposed an action cannot be the same user who approves
it. This is a security feature, not a misconfiguration.

---

## Running the automated experiment

```bash
PORTARIUM_URL=http://localhost:3000 \
PORTARIUM_WORKSPACE_ID=ws-experiment \
PORTARIUM_BEARER_TOKEN=dev-token \
PORTARIUM_OPERATOR_TOKEN=dev-token-operator \
PORTARIUM_TENANT_ID=default \
node node_modules/tsx/dist/cli.mjs experiments/openclaw-governance/run.mjs
```

Expected output: `Result: [CONFIRMED] (…ms)` with 7 PASSes.

---

## Running the live agent

```bash
OPENCLAW_CONFIG_PATH="<home>/.openclaw-portarium-dev/openclaw.json" \
  openclaw agent --local --session-id portarium-test \
  --message "List files in C:/tmp"
```

The agent will log `[portarium] Awaiting approval for: exec (approvalId=...)` and suspend.
Then approve from a separate terminal:

```bash
curl -X POST "http://localhost:3000/v1/workspaces/ws-experiment/approvals/<approvalId>/decide" \
  -H "content-type: application/json" \
  -H "authorization: Bearer dev-token-operator" \
  -H "x-portarium-workspace-id: ws-experiment" \
  -H "x-portarium-tenant-id: default" \
  -d '{"decision": "Approved", "rationale": "Operator approved"}'
```

The agent will log `[portarium] Approved by human: exec` and complete the tool call.
