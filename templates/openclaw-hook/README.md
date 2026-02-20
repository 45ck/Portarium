# OpenClaw Hook + Portarium Template

Starter template for an OpenClaw `before_tool_call` hook that routes tool invocations
through the Portarium control plane for policy checks and audit.

## What This Template Does

- Intercepts OpenClaw tool calls via `before_tool_call` hooks
- Submits each tool call to Portarium for policy evaluation before execution
- Blocks tool calls that violate workspace policy (blast-radius tier, SoD constraints)
- Records evidence for every tool invocation attempt

## Prerequisites

- OpenClaw Gateway instance registered with Portarium
- Portarium workspace with configured tool blast-radius policies
- Python >= 3.10

## Project Structure

```
openclaw-hook/
  hooks.py              # before_tool_call / after_tool_call hook implementations
  portarium_policy.py   # Policy check client
  config.yaml           # Hook configuration
  README.md             # This file
```

## How It Works

1. OpenClaw invokes `before_tool_call` before executing any tool
2. The hook sends tool name + arguments to Portarium's policy evaluation endpoint
3. Portarium evaluates blast-radius tier, workspace policy, and SoD constraints
4. If the policy result is `Allow` or `HumanApprove`, the tool proceeds
5. If `Deny`, the hook returns an error and the tool call is blocked
6. `after_tool_call` records the execution result as evidence

## Configuration

Edit `config.yaml`:

```yaml
portarium:
  base_url: https://portarium.example.com
  workspace_id: ws-your-workspace
  # Token is read from PORTARIUM_TOKEN env var
```
