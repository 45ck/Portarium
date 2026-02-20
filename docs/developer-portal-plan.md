# Developer Portal Plan

**Bead:** bead-0685
**Priority:** P3
**Date:** 2026-02-21

## Overview

The Portarium developer portal provides a single entry point for third-party
and internal developers to discover, learn, and integrate with the control
plane API. It complements the CLI and SDK with browser-based documentation,
interactive exploration, and a local emulator for offline development.

## Architecture

### Components

| Component               | Technology                   | Purpose                                     |
| ----------------------- | ---------------------------- | ------------------------------------------- |
| API Reference           | OpenAPI + Redocly/Stoplight  | Auto-generated from `openapi.yaml`          |
| Getting Started Guides  | Markdown (Diátaxis)          | Tutorials, how-tos, explanations            |
| Interactive API Explorer| Swagger UI / Scalar          | Try-it-out console against staging or local |
| Local Emulator          | TypeScript (in-process)      | Simulates run lifecycle without infra        |
| Search                  | Pagefind or Algolia          | Full-text search across docs                |

### Rendering pipeline

```text
openapi.yaml  ───> Redocly build ───> HTML API reference
docs/**/*.md  ───> Static site gen ──> Markdown pages
examples/**   ───> Code samples ─────> Embedded snippets
```

The portal is a static site generated at CI time and deployed to CDN.
No server-side runtime is required.

### API reference generation

The OpenAPI spec at `src/infrastructure/openapi/openapi.yaml` is the single
source of truth. The build pipeline:

1. Validates the spec with `redocly lint`.
2. Bundles and dereferences to a single file.
3. Generates HTML with `redocly build-docs`.
4. Injects into the portal layout under `/api/`.

### Getting started guides

Follow the Diátaxis framework (tutorials, how-tos, reference, explanation):

- **Tutorial:** "Your first governed run" -- end-to-end walkthrough.
- **How-to:** "Register an agent," "Configure approval gates," "Set up MCP server."
- **Reference:** Auto-generated API reference + CLI reference.
- **Explanation:** Architecture overview, governance model, migration phases.

### Interactive API explorer

Embed Scalar or Swagger UI at `/api/explorer` pointing at:

- **Local emulator** (default for getting-started).
- **Staging environment** (for authenticated exploration).

The explorer reads the same OpenAPI spec as the reference docs.

## Local emulator

The emulator (`src/infrastructure/emulator/run-emulator.ts`) simulates the
run lifecycle without requiring Temporal, PostgreSQL, or any external service.

### State machine

```text
start() --> Pending --> Approved --> Executing --> Completed
                |                       |
                +--> Denied             +--> Failed
```

### Capabilities

- Start, approve/deny, and complete runs in-memory.
- Deterministic state transitions for integration testing.
- No network calls, no persistence, no external dependencies.
- Configurable delays for simulating async behavior.

### Limitations (by design)

- Single-process, single-tenant only.
- No real policy evaluation (always passes).
- No real credential management.
- No event streaming (returns snapshots).

## Deployment

| Environment | Hosting    | URL pattern                       |
| ----------- | ---------- | --------------------------------- |
| Production  | CDN        | `https://docs.portarium.dev/`     |
| Preview     | PR preview | `https://pr-{n}.docs.portarium.dev/` |
| Local       | `npm run docs:dev` | `http://localhost:4000/`  |

## Roadmap

1. **v0.1** -- API reference from OpenAPI + getting-started tutorial.
2. **v0.2** -- Interactive explorer + local emulator integration.
3. **v0.3** -- Search, versioned docs, SDK reference (TypeScript/Python/Go).
4. **v1.0** -- Community contributions, changelog feed, status page.
