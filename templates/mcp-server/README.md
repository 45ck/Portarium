# MCP Server + Portarium Template

Starter template for a Model Context Protocol (MCP) server that exposes Portarium
control-plane operations as tools for LLM agents.

## What This Template Does

- Exposes Portarium operations (start run, check approval, query evidence) as MCP tools
- Agents connecting via MCP automatically route work through Portarium governance
- All tool calls are workspace-scoped and policy-checked

## Prerequisites

- Node.js >= 20
- A Portarium workspace with a valid API token

## Quick Start

```bash
cp .env.example .env
# Edit .env with your Portarium workspace URL and token
npm install
npm start
```

## Project Structure

```
mcp-server/
  server.ts             # MCP server definition with Portarium tools
  .env.example          # Environment variable template
  package.json          # Node.js dependencies
  tsconfig.json         # TypeScript configuration
  README.md             # This file
```

## Exposed Tools

| Tool | Description |
|------|-------------|
| `portarium_start_run` | Start a workflow run in a workspace |
| `portarium_get_run` | Get the status of a workflow run |
| `portarium_list_approvals` | List pending approvals in a workspace |
| `portarium_decide_approval` | Approve or deny a pending approval |
| `portarium_query_evidence` | Query the evidence/audit trail |

## Configuration

| Variable | Description |
|----------|-------------|
| `PORTARIUM_BASE_URL` | Portarium control plane URL |
| `PORTARIUM_TOKEN` | Workspace-scoped JWT |
| `PORTARIUM_WORKSPACE_ID` | Default workspace ID |
| `MCP_PORT` | MCP server port (default: 3100) |
