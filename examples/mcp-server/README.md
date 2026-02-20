# Portarium MCP Server Template

Minimal Model Context Protocol server that exposes Portarium control-plane
operations as MCP tools.

## Quick start

```bash
cd examples/mcp-server
npm install
PORTARIUM_BASE_URL=http://localhost:3100 \
PORTARIUM_TOKEN=<jwt> \
  npm start
```

## Exposed tools

| Tool                        | Description                          |
| --------------------------- | ------------------------------------ |
| `portarium_start_run`       | Start a governed workflow run        |
| `portarium_get_run`         | Query run status                     |
| `portarium_cancel_run`      | Cancel an in-progress run            |
| `portarium_submit_approval` | Submit an approval decision           |

## Client configuration

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "portarium": {
      "command": "npx",
      "args": ["tsx", "/path/to/examples/mcp-server/server.ts"],
      "env": {
        "PORTARIUM_BASE_URL": "http://localhost:3100",
        "PORTARIUM_TOKEN": "<your-jwt>",
        "PORTARIUM_WORKSPACE_ID": "ws-default"
      }
    }
  }
}
```

### Cursor / VS Code

Add to your MCP settings:

```json
{
  "name": "portarium",
  "transport": "stdio",
  "command": "npx",
  "args": ["tsx", "/path/to/examples/mcp-server/server.ts"],
  "env": {
    "PORTARIUM_BASE_URL": "http://localhost:3100",
    "PORTARIUM_TOKEN": "<your-jwt>"
  }
}
```

## Environment variables

| Variable                 | Required | Default                 |
| ------------------------ | -------- | ----------------------- |
| `PORTARIUM_BASE_URL`     | No       | `http://localhost:3100` |
| `PORTARIUM_TOKEN`        | Yes      | --                      |
| `PORTARIUM_WORKSPACE_ID` | No       | `ws-default`            |

## Production notes

- Use the `@modelcontextprotocol/sdk` `Server` class for full protocol
  compliance (session management, streaming, resources).
- Add tools for event tailing (`events/tail` via SSE) for real-time
  notifications.
- Integrate with the Portarium Agent Gateway for multi-tenant isolation.
