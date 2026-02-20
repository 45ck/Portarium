# Developer Portal Design

**Beads:** bead-0648 (bead-0685 original reference)
**Status:** Draft
**Date:** 2026-02-21

## Overview

The Portarium Developer Portal is the primary self-service surface for developers building
agents, workflows, and integrations on the Portarium platform. It combines interactive
API documentation, a local emulator for offline development, and SDK quickstart flows.

## Goals

1. **Reduce time-to-first-run** -- a developer should start a workflow run within 10 minutes
   of arriving at the portal
2. **Self-service API exploration** -- interactive OpenAPI and gRPC documentation with
   workspace-scoped try-it-now
3. **Local development parity** -- a local emulator that mimics control-plane behaviour
   without requiring a running cluster
4. **SDK discoverability** -- quickstart guides for Python, Go, TypeScript, MCP, and
   OpenAI Agents SDK integrations

## Portal Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Developer Portal                     │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ API Explorer │  │ Quickstarts  │  │  Guides     │ │
│  │ (Scalar/     │  │ (SDK setup,  │  │  (concepts, │ │
│  │  Stoplight)  │  │  templates)  │  │  tutorials) │ │
│  └─────────────┘  └──────────────┘  └─────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │            Local Emulator                         │ │
│  │  (Portable control plane for offline dev)         │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

## Key Surfaces

### 1. API Explorer

- **Source:** `docs/spec/openapi/portarium-control-plane.v1.yaml`
- **Renderer:** Scalar or Stoplight Elements (both support OpenAPI 3.1)
- **Features:**
  - Interactive try-it-now with workspace-scoped auth
  - Request/response examples for every endpoint
  - Schema explorer with branded-type annotations
  - gRPC proto documentation (rendered from proto files)

### 2. Quickstart Guides

- **Python SDK:** Generated client setup, auth, first run (links to `docs/sdk/python-client-generation.md`)
- **Go SDK:** Generated client setup, auth, first run (links to `docs/sdk/go-client-generation.md`)
- **TypeScript SDK:** `PortariumClient` facade usage
- **MCP Server:** Template setup for LLM agent integration (links to `templates/mcp-server/`)
- **OpenAI Agents SDK:** Tool wrapper setup (links to `templates/openai-agents-sdk/`)
- **CLI:** Installation and first commands (links to CLI spec)

### 3. Conceptual Guides

- Control plane architecture (governance, policy, evidence)
- Workflow lifecycle (plan, approve, execute, verify)
- Agent integration patterns (SDK, MCP, OpenClaw hooks)
- Robot/fleet integration (gRPC telemetry, mission lifecycle)
- Security model (JWT, mTLS, credential vaulting)

### 4. Local Emulator

The local emulator provides a standalone control plane for offline development:

- **Scope:** workspace CRUD, run lifecycle, approval flow, policy evaluation, evidence recording
- **Storage:** SQLite (single file, no external dependencies)
- **Auth:** Accepts any bearer token in local mode (no external IdP required)
- **Events:** In-process event bus (no NATS dependency)
- **Start:** `portarium emulator start` (CLI command) or `docker compose -f docker-compose.local.yml up`

#### Emulator boundaries

| Feature                               | Emulated | Not emulated               |
| ------------------------------------- | -------- | -------------------------- |
| Workspace CRUD                        | Yes      | --                         |
| Run lifecycle (start, status, cancel) | Yes      | --                         |
| Approval flow                         | Yes      | --                         |
| Policy evaluation (inline DSL)        | Yes      | --                         |
| Evidence recording                    | Yes      | --                         |
| Temporal workflows                    | No       | Uses synchronous execution |
| NATS event stream                     | No       | In-process event bus       |
| Vault credential storage              | No       | Env-var credentials        |
| gRPC telemetry/control                | No       | REST-only in emulator      |
| Multi-tenant isolation                | No       | Single workspace           |

## Technology Choices

| Component      | Choice                     | Reason                           |
| -------------- | -------------------------- | -------------------------------- |
| Static site    | VitePress or Docusaurus    | Markdown-first, plugin ecosystem |
| API renderer   | Scalar                     | Modern UI, OpenAPI 3.1 support   |
| Local emulator | Node.js + SQLite           | Zero external dependencies       |
| Hosting        | Vercel or Cloudflare Pages | Free tier, CDN, preview deploys  |

## Implementation Phases

### Phase 1: Static docs + API explorer

- Deploy VitePress site with existing markdown docs
- Embed Scalar API explorer with the OpenAPI spec
- Quickstart guides for Python, Go, TypeScript

### Phase 2: Local emulator

- Implement emulator as a standalone Node.js server
- SQLite storage for workspace, run, approval, evidence entities
- CLI integration (`portarium emulator start`)

### Phase 3: Interactive tutorials

- Guided flows ("Build your first agent in 10 minutes")
- Workspace sandbox with ephemeral workspace creation
- Code playground with live API calls

## Security Considerations

- Portal serves public documentation; no sensitive data
- Try-it-now requires user authentication (OIDC redirect)
- Local emulator runs on `localhost` only by default
- Emulator does not accept production credentials
