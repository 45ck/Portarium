# Developer Portal Contract v1

**Beads:** bead-0648 (bead-0685 original reference)

## Purpose

Define the contract for the Portarium Developer Portal, including API documentation,
SDK quickstart flows, local emulator behaviour, and content structure.

## Scope

- Static documentation site with interactive API explorer
- Local emulator for offline development
- SDK quickstart guides for Python, Go, TypeScript, MCP, OpenAI Agents SDK
- Conceptual guides for architecture, security, and integration patterns

## Portal Endpoints

- `/` -- landing page with quickstart links
- `/api` -- interactive API explorer (Scalar, sourced from OpenAPI spec)
- `/guides/` -- conceptual guides (architecture, security, workflows)
- `/sdk/python` -- Python SDK quickstart
- `/sdk/go` -- Go SDK quickstart
- `/sdk/typescript` -- TypeScript SDK quickstart
- `/sdk/mcp` -- MCP server template quickstart
- `/sdk/openai-agents` -- OpenAI Agents SDK quickstart
- `/cli` -- CLI installation and usage

## Local Emulator Contract

### Start

- `portarium emulator start [--port 3100]`
- Starts a local HTTP server on `localhost`

### Supported API surface

- `GET/POST /v1/workspaces` -- workspace CRUD
- `POST /v1/workspaces/{id}/runs` -- start a run
- `GET /v1/workspaces/{id}/runs/{runId}` -- run status
- `POST /v1/workspaces/{id}/runs/{runId}/cancel` -- cancel
- `GET /v1/workspaces/{id}/approvals` -- list approvals
- `POST /v1/workspaces/{id}/approvals/{id}/decide` -- decide
- `GET /v1/workspaces/{id}/evidence` -- query evidence

### Auth

- Accepts any `Authorization: Bearer <token>` in local mode
- No token validation (development convenience)

### Storage

- SQLite database at `~/.portarium/emulator.db`
- Reset via `portarium emulator reset`

## Acceptance Criteria

1. Design document published at `docs/developer-portal-design.md`
2. API explorer renders current OpenAPI spec interactively
3. Local emulator supports core run lifecycle (start, status, cancel)
4. Quickstart guides cover all five SDK/integration paths
5. Portal deploys to a static hosting provider with preview deploys
