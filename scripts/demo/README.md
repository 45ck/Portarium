# Portarium Demo Scripts

Three scripts implement the demo approval flow for agent tool invocations:

| Script                          | npm alias              | Role                                                          |
| ------------------------------- | ---------------------- | ------------------------------------------------------------- |
| `portarium-tool-proxy.mjs`      | `npm run demo:proxy`   | HTTP gateway that evaluates policies and gates tool calls     |
| `portarium-approval-cli.mjs`    | `npm run demo:approve` | Interactive CLI for human operators to approve/deny requests  |
| `portarium-approval-plugin.mjs` | _(library import)_     | Reusable polling helper that agents import to await decisions |

## Quick start (local demo proxy)

```bash
# Terminal 1 — start the proxy
npm run demo:proxy

# Terminal 2 — start the approval CLI
npm run demo:approve

# Terminal 3 — invoke a tool (will be gated)
curl -X POST http://localhost:9999/tools/invoke \
  -H 'Content-Type: application/json' \
  -d '{"toolName":"shell.exec","parameters":{"command":"echo hello"}}'
```

## Using Real Control Plane (ADR-0117 H9 path)

All three scripts support connecting to a real Portarium control plane
instead of the local in-process policy engine.

### Proxy

**CLI flags** (preferred):

```bash
npm run demo:proxy -- \
  --use-control-plane \
  --cp-url http://localhost:4400 \
  --workspace-id ws-001 \
  --bearer-token tok_xxx
```

**Environment variables** (alternative):

```bash
CONTROL_PLANE_URL=http://localhost:4400 \
WORKSPACE_ID=ws-001 \
BEARER_TOKEN=tok_xxx \
  npm run demo:proxy
```

When configured, `POST /tools/invoke` delegates to
`POST /v1/workspaces/:wsId/agent-actions:propose` on the control plane.
`NeedsApproval` responses are mirrored into the local approval store so
the proxy's poll endpoint (`GET /approvals/:id`) keeps working for
backward-compatible agents.

### CLI

```bash
npm run demo:approve -- \
  --control-plane http://localhost:4400 \
  --workspace-id ws-001 \
  --bearer-token tok_xxx
```

The CLI lists pending approvals from
`GET /v1/workspaces/:wsId/approvals?status=Pending` and submits decisions to
`POST /v1/workspaces/:wsId/approvals/:id/decide` with PascalCase decisions
(`Approved` / `Denied`).

### Plugin (programmatic)

```javascript
import { waitForApproval, proposeAgentAction } from './portarium-approval-plugin.mjs';

// Poll for an approval decision via the real control plane
const decision = await waitForApproval(approvalId, proxyUrl, {
  controlPlane: {
    url: 'http://localhost:4400',
    workspaceId: 'ws-001',
    bearerToken: 'tok_xxx',
  },
});

// Propose an agent action directly
const proposal = await proposeAgentAction(
  { url: 'http://localhost:4400', workspaceId: 'ws-001', bearerToken: 'tok_xxx' },
  {
    agentId: 'my-agent',
    actionKind: 'tool:invoke',
    toolName: 'shell.exec',
    executionTier: 'HumanApprove',
    policyIds: ['default'],
    rationale: 'Need to run a shell command',
  },
);
```

## Protocol summary

| Operation     | Demo Proxy                                  | Real Control Plane                                  |
| ------------- | ------------------------------------------- | --------------------------------------------------- |
| Propose tool  | `POST /tools/invoke`                        | `POST /v1/workspaces/:wsId/agent-actions:propose`   |
| List pending  | `GET /approvals?status=pending`             | `GET /v1/workspaces/:wsId/approvals?status=Pending` |
| Poll one      | `GET /approvals/:id`                        | `GET /v1/workspaces/:wsId/approvals/:id`            |
| Decide        | `POST /approvals/:id/decide`                | `POST /v1/workspaces/:wsId/approvals/:id/decide`    |
| Status casing | lowercase (`pending`, `approved`, `denied`) | PascalCase (`Pending`, `Approved`, `Denied`)        |
| Auth          | none                                        | `Authorization: Bearer <token>`                     |
