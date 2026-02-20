# OpenAI Agents SDK + Portarium Template

Starter template for building an OpenAI Agents SDK agent that routes all tool calls
through the Portarium control plane.

## What This Template Does

- Wraps OpenAI Agents SDK tool definitions to route through Portarium
- Ensures every external action is policy-checked, approved, and audited
- Agents never hold SoR credentials directly

## Prerequisites

- Python >= 3.10
- `pip install openai-agents portarium-client`
- A Portarium workspace with a valid API token

## Quick Start

```bash
cp .env.example .env
# Edit .env with your Portarium workspace URL and token
pip install -r requirements.txt
python agent.py
```

## Project Structure

```
openai-agents-sdk/
  agent.py              # Agent definition with Portarium-routed tools
  portarium_tools.py    # Tool wrapper that routes calls through Portarium
  .env.example          # Environment variable template
  requirements.txt      # Python dependencies
  README.md             # This file
```

## How It Works

1. Define tools as normal OpenAI Agents SDK functions
2. The `portarium_tool` decorator intercepts tool calls
3. Instead of calling the SoR directly, it submits a run to Portarium
4. Portarium evaluates policy, requests approval if needed, then executes
5. The result flows back through Portarium with full audit trail

## Configuration

| Variable | Description |
|----------|-------------|
| `PORTARIUM_BASE_URL` | Portarium control plane URL |
| `PORTARIUM_TOKEN` | Workspace-scoped JWT |
| `PORTARIUM_WORKSPACE_ID` | Target workspace ID |
