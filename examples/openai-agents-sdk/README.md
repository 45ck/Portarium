# Portarium + OpenAI Agents SDK Example

Wrap Portarium workflow runs as an OpenAI Agents SDK tool so every SoR
side-effect is governed, policy-checked, and audited.

## Quick start

```bash
cd examples/openai-agents-sdk
npm install
PORTARIUM_BASE_URL=http://localhost:3100 \
PORTARIUM_TOKEN=<your-jwt> \
PORTARIUM_WORKSPACE_ID=ws-default \
  npm start
```

## How it works

1. **Tool definition** -- `portariumRunTool` is a standard OpenAI function-tool
   schema that you register in your agent's `tools` array.
2. **Tool handler** -- When the agent calls `portarium_start_run`, the handler
   POSTs to the Portarium control-plane `/runs` endpoint, then polls for
   completion.
3. **Governance** -- Because every run goes through the control plane, policy
   evaluation, approval gates, and audit logging apply automatically.

## Integration pattern

```text
Agent  -->  portarium_start_run tool  -->  Control Plane /runs
                                              |
                                        policy check
                                        approval gate
                                        evidence log
                                              |
                                         SoR adapter
```

## Environment variables

| Variable                 | Required | Default                 |
| ------------------------ | -------- | ----------------------- |
| `PORTARIUM_BASE_URL`     | No       | `http://localhost:3100` |
| `PORTARIUM_TOKEN`        | Yes      | --                      |
| `PORTARIUM_WORKSPACE_ID` | No       | `ws-default`            |

## Production considerations

- Replace polling with SSE event tailing for real-time status.
- Use the `PortariumClient` facade (see `src/infrastructure/sdk/`) for retry
  and correlation-ID propagation.
- Store tokens securely (Vault, environment secrets) -- never hard-code JWTs.
