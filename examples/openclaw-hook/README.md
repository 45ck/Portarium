# Portarium OpenClaw Hook

Pre-execution hook that blocks non-Portarium tool calls, funneling all
SoR interactions through `client.runs.start()`.

## Purpose

When installed in an OpenClaw workspace, this hook intercepts every tool
invocation and checks whether it was routed through the Portarium control
plane. Unrouted calls are rejected with a message instructing the agent to
use the Portarium SDK.

## Installation

1. Copy `hook.ts` into your OpenClaw workspace scripts directory.

2. Add to your OpenClaw workspace configuration:

   ```yaml
   hooks:
     pre_tool_call:
       - type: script
         path: ./hook.ts
   ```

3. Set environment variables:

   ```bash
   export PORTARIUM_BASE_URL=http://localhost:3100
   export PORTARIUM_ENFORCE=true
   # Optional: comma-separated tools that bypass routing
   export PORTARIUM_ALLOWLIST=read_file,list_directory
   ```

## Modes

| Mode         | `PORTARIUM_ENFORCE` | Behavior                          |
| ------------ | ------------------- | --------------------------------- |
| **Enforce**  | `true` (default)    | Block unrouted calls              |
| **Audit**    | `false`             | Log warning, allow call           |

## Testing locally

```bash
echo '{"toolName":"create_invoice","toolArgs":{},"workspaceId":"ws-1"}' | npm start
# Output: {"allow":false,"reason":"Tool \"create_invoice\" must be invoked..."}

echo '{"toolName":"create_invoice","toolArgs":{},"workspaceId":"ws-1","portariumRunId":"run-abc"}' | npm start
# Output: {"allow":true}
```

## How it fits

```text
Agent tool call
      |
  OpenClaw pre_tool_call hook
      |
  portariumRunId present?  --yes-->  ALLOW
      |no
  On allowlist?  --yes-->  ALLOW
      |no
  ENFORCE=true?  --yes-->  BLOCK (instruct agent to use Portarium SDK)
      |no
  ALLOW (with audit warning)
```

## Migration phases

This hook supports the migration path defined in ADR-0073:

- **Phase 1 (Visibility):** Set `PORTARIUM_ENFORCE=false` to audit.
- **Phase 3 (Routing by default):** Set `PORTARIUM_ENFORCE=true` to block.
- **Phase 4 (Enforcement):** Combine with egress deny-by-default network policies.
