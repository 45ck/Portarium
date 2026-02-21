# Portarium

Open-source control plane for governable operations across existing systems.

[![CI (PR)](https://github.com/45ck/Portarium/actions/workflows/ci.yml/badge.svg)](https://github.com/45ck/Portarium/actions/workflows/ci.yml)

## Architecture

<p align="center">
  <img src="docs/diagrams/generated/09_isometric_minimal_fusion_textonly_v3_user_left.jpg" alt="Portarium Architecture Overview" />
</p>

Portarium sits between people and execution systems:

- Top: agents, automations, OpenClaw, physical robots
- Middle: Portarium control plane (policy, approvals, orchestration, evidence)
- Bottom: services, software, APIs, and tools

## Why Portarium

- Governed execution tiers: `Auto`, `Assisted`, `Human-approve`, `Manual-only`
- Explicit approvals and workspace-scoped operations
- Evidence-first operation history for audit and review
- Ports/Adapters model for integrating existing systems of record

## Quickstart

Prerequisites: Node.js `>=22`, Docker + Docker Compose, npm

```bash
npm ci
docker compose up -d
npx tsx src/presentation/runtime/control-plane.ts
```

In another terminal:

```bash
PORTARIUM_ENABLE_TEMPORAL_WORKER=true npx tsx src/presentation/runtime/worker.ts
```

Health checks:

```bash
curl -s http://localhost:8080/healthz
curl -s http://localhost:8081/healthz
```

## Docs

- Start here: `docs/index.md`
- Architecture: `docs/explanation/architecture.md`
- Local development: `docs/getting-started/local-dev.md`
- HTTP API reference: `docs/reference/http-api.md`
- OpenAPI contract: `docs/spec/openapi/portarium-control-plane.v1.yaml`
- Integration model: `docs/explanation/ports-and-adapters.md`
- Contribution flow: `CONTRIBUTING.md`

## Status

Early and actively built. Runtime and contract foundations are in place; some integration and persistence paths are still scaffold-stage.

## License

Released under the MIT License. See `LICENSE`.
