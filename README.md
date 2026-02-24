# Portarium

Open-source control plane for governable operations across existing systems.

[![CI (PR)](https://github.com/45ck/Portarium/actions/workflows/ci.yml/badge.svg)](https://github.com/45ck/Portarium/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/45ck/Portarium/branch/main/graph/badge.svg)](https://codecov.io/gh/45ck/Portarium)
[![Storybook](https://github.com/45ck/Portarium/actions/workflows/chromatic.yml/badge.svg)](https://github.com/45ck/Portarium/actions/workflows/chromatic.yml)

## Architecture

<p align="center">
  <img src="docs/diagrams/generated/09_isometric_minimal_fusion_textonly_v3_user_left.jpg" alt="Portarium Architecture Overview" />
</p>

Portarium sits between people and execution systems:

- Top: agents, automations, OpenClaw, physical robots
- Middle: Portarium control plane (policy, approvals, orchestration, evidence)
- Bottom: services, software, APIs, and tools

## Feature Showcase

### Approvals UX v2 (Cockpit)

<p align="center">
  <img src="docs/internal/ui/cockpit/media/approvals-v2-showcase.gif" alt="Approvals UX v2 showcase: pending queue, triage panel, and approval detail" />
</p>

The approvals v2 flow in Cockpit demonstrates fast triage with policy context, decision rationale capture, and evidence-linked run governance.

### Tinder-Style AI Approvals (OpenClaw, iPhone)

<p align="center">
  <img src="docs/internal/ui/cockpit/media/openclaw-tinder-approvals-iphone.gif" alt="iPhone-style Tinder approval flow for AI agents: briefing first, policy-aware review, approve/deny decisions" width="320" />
</p>

Portarium acts as the control-plane for autonomous agents: OpenClaw can propose actions, but execution is gated by policy and manual approvals. The mobile triage flow is Tinder-style card review: policy determines what is auto-approved, what needs a swipe decision, and what is blocked.

- MP4 showcase: [openclaw-tinder-approvals-iphone.mp4](docs/internal/ui/cockpit/media/openclaw-tinder-approvals-iphone.mp4)
- Generation command: `npm run cockpit:demo:openclaw:iphone`
- Desktop OpenClaw clips: `npm run cockpit:demo:openclaw:clips`

### OpenClaw Governance Clips (Desktop)

<p align="center">
  <img src="docs/internal/ui/cockpit/media/openclaw-destructive-blocked-desktop.gif" alt="Desktop OpenClaw governance clip: destructive delete-all-emails action is denied by policy" />
</p>

- Heartbeat Watchtower: [openclaw-heartbeat-watchtower-desktop.mp4](docs/internal/ui/cockpit/media/openclaw-heartbeat-watchtower-desktop.mp4)
- Destructive action blocked: [openclaw-destructive-blocked-desktop.mp4](docs/internal/ui/cockpit/media/openclaw-destructive-blocked-desktop.mp4)
- Cron and sub-agent governance: [openclaw-cron-subagent-desktop.mp4](docs/internal/ui/cockpit/media/openclaw-cron-subagent-desktop.mp4)

## Why Portarium

- Governed execution tiers: `Auto`, `Assisted`, `Human-approve`, `Manual-only`
- Explicit approvals and workspace-scoped operations
- Evidence-first operation history for audit and review
- Ports/Adapters model for integrating existing systems of record

## Agent Traffic Controller

Portarium acts as the agent traffic controller: agents submit intended actions
to the control plane, Portarium evaluates policy and approvals, executes via
connectors, and returns evidence-backed results.

## Quickstart

Prerequisites: Node.js `>=22`, Docker + Docker Compose, npm

```bash
npm ci
# Start infrastructure (choose the profiles you need):
#   baseline  — Postgres only (unit tests + migrations)
#   runtime   — + Temporal + MinIO evidence store
#   auth      — + HashiCorp Vault
#   tools     — + OTel Collector + Tempo + Grafana
COMPOSE_PROFILES=baseline,runtime,auth docker compose up -d
PORTARIUM_USE_POSTGRES_STORES=true PORTARIUM_DATABASE_URL=postgresql://portarium:portarium@localhost:5432/portarium \
npx tsx src/presentation/runtime/control-plane.ts
```

> **Store configuration required.** The control plane will refuse to start unless either:
>
> - `PORTARIUM_USE_POSTGRES_STORES=true` + `PORTARIUM_DATABASE_URL` is set (real Postgres), or
> - `DEV_STUB_STORES=true` + `NODE_ENV=development` or `test` (in-memory stubs for local iteration only — data does not persist).
>
> Setting neither will produce a FATAL startup error. This prevents silently deploying a non-functional system.

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

- If you only read one page next: `docs/index.md`
- Evaluate in 15-30 min: `docs/getting-started/hello-portarium.md`
- Run the local stack: `docs/getting-started/local-dev.md`
- Understand the architecture: `docs/explanation/architecture.md`
- Agent traffic controller model: `docs/explanation/agent-traffic-controller.md`
- API contract (OpenAPI): `docs/spec/openapi/portarium-control-plane.v1.yaml`
- HTTP API reference: `docs/reference/http-api.md`
- Integration model: `docs/explanation/ports-and-adapters.md`
- Contribution flow: `CONTRIBUTING.md`

## Community

- Questions and usage help: [GitHub Discussions](https://github.com/45ck/Portarium/discussions)
- Bug reports and feature proposals: [GitHub Issues](https://github.com/45ck/Portarium/issues/new/choose)
- Security reports: [GitHub Security Advisories](https://github.com/45ck/Portarium/security/advisories/new)

## Cockpit Showcase

![Approvals v2 demo showcase](docs/internal/ui/cockpit/demo-machine/showcase/approvals-v2-approval-gate.gif)

See scripted demo specs and capture docs at `docs/internal/ui/cockpit/demo-machine/README.md`.

## Status

Early and actively built. Runtime and contract foundations are in place; some integration and persistence paths are still scaffold-stage.

## License

Released under the MIT License. See `LICENSE`.
