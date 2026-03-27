# Portarium

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner.dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="assets/banner.light.png" />
    <img src="assets/banner.light.png" alt="Portarium banner" width="100%" />
  </picture>
</p>

Validation middleware and policy control plane for governed AI execution.

[![CI (PR)](https://github.com/45ck/Portarium/actions/workflows/ci.yml/badge.svg)](https://github.com/45ck/Portarium/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/45ck/Portarium/branch/main/graph/badge.svg)](https://codecov.io/gh/45ck/Portarium)
[![Storybook](https://github.com/45ck/Portarium/actions/workflows/chromatic.yml/badge.svg)](https://github.com/45ck/Portarium)

## Why this exists

Most agent demos fail in production for boring reasons:

- they can propose actions, but nothing validates whether those actions should run
- approvals are bolted on after the fact instead of being part of the execution path
- evidence is fragmented across logs, prompts, and side effects
- operators cannot explain who approved what, under which policy, and why

Portarium exists to close that gap.

It sits between an agent and the systems that agent wants to touch. The agent can still plan, draft, and propose. Portarium decides whether the action is allowed, needs approval, or must be blocked, then records the evidence trail around the decision.

This is the engineering problem behind the "90% failure gap" in agentic systems: getting from "almost works" to "actually works" requires governance in the execution path, not just a better prompt.

## What Portarium is

Portarium is an open-source control plane for governed operations:

- policy evaluation before side effects
- approval workflows for human-in-the-loop execution
- orchestration and state transitions for governed runs
- evidence capture for audit, review, and rollback
- connectors that let existing systems stay systems of record

The framing is deliberate: Portarium is not the agent. It is the layer that makes agents usable in production.

## Architecture

<p align="center">
  <img src="docs/diagrams/generated/09_isometric_minimal_fusion_textonly_v3_user_left.jpg" alt="Portarium Architecture Overview" />
</p>

Portarium sits between people, agents, and execution systems:

- top layer: operators, agents, automations, OpenClaw, physical robots
- middle layer: Portarium control plane for policy, approvals, orchestration, and evidence
- bottom layer: APIs, software systems, tools, infrastructure, and robots

Execution flow:

1. An agent proposes an action.
2. Portarium evaluates policy, workspace scope, and blast radius.
3. The run is auto-approved, queued for approval, or blocked.
4. Approved actions execute through connectors.
5. Evidence, rationale, and lifecycle state are stored for later review.

Core promise: agents can think and propose actions, but policy and approvals decide what executes.

## Before and after Portarium

| Without a control plane                | With Portarium in the path                       |
| -------------------------------------- | ------------------------------------------------ |
| Agent calls tools directly             | Agent submits intent to a governed run           |
| Prompt text carries the policy burden  | Policy is explicit and enforced before execution |
| Approval is ad hoc, manual, or absent  | Approval is a first-class runtime state          |
| Logs exist, but evidence is fragmented | Decision, execution, and evidence stay linked    |
| Failures are hard to replay or explain | Runs are reviewable, attributable, and auditable |

This is the practical reliability shift Portarium is aiming for. Not "perfect autonomy." Governed execution with visible boundaries.

## OpenClaw integration

OpenClaw is the operator. Portarium is the governance layer.

The intended pattern looks like this:

1. OpenClaw classifies a task or proposes a tool action.
2. Portarium evaluates policy and risk for that action.
3. Low-risk actions can proceed automatically.
4. Higher-risk actions pause in an approval queue.
5. Portarium returns evidence-backed outcomes to OpenClaw and the human operator.

That split is what makes the combined system commercially interesting:

- OpenClaw shows that meaningful business workflows can be automated
- Portarium shows those workflows can still be governed, reviewed, and constrained

If you are building agent workflows, Portarium is the layer that keeps "helpful automation" from turning into "untraceable side effects."

## Feature showcase

### Approvals UX v2 (Cockpit)

<p align="center">
  <img src="docs/internal/ui/cockpit/media/approvals-v2-showcase.gif" alt="Approvals UX v2 showcase: pending queue, triage panel, and approval detail" />
</p>

The approvals v2 flow in Cockpit demonstrates fast triage with policy context, decision rationale capture, and evidence-linked run governance.

### OpenClaw approvals on mobile

<p align="center">
  <a href="docs/internal/ui/cockpit/media/openclaw-tinder-approvals-iphone.mp4">
    <img src="docs/internal/ui/cockpit/media/openclaw-tinder-approvals-iphone.gif" alt="iPhone-style approval flow for OpenClaw actions: briefing first, policy-aware review, approve or deny decisions" width="320" />
  </a>
</p>

This flow shows the control-plane model in practice. OpenClaw can propose work, but policy determines what is auto-approved, what needs a human decision, and what is blocked entirely.

- MP4 showcase: [openclaw-tinder-approvals-iphone.mp4](docs/internal/ui/cockpit/media/openclaw-tinder-approvals-iphone.mp4)
- Generation command: `npm run cockpit:demo:openclaw:iphone`
- Desktop OpenClaw clips: `npm run cockpit:demo:openclaw:clips`

### OpenClaw governance clips (desktop)

<p align="center">
  <img src="docs/internal/ui/cockpit/media/openclaw-destructive-blocked-desktop.gif" alt="Desktop OpenClaw governance clip: destructive delete-all-emails action is denied by policy" />
</p>

- Heartbeat Watchtower: [openclaw-heartbeat-watchtower-desktop.mp4](docs/internal/ui/cockpit/media/openclaw-heartbeat-watchtower-desktop.mp4)
- Destructive action blocked: [openclaw-destructive-blocked-desktop.mp4](docs/internal/ui/cockpit/media/openclaw-destructive-blocked-desktop.mp4)
- Cron and sub-agent governance: [openclaw-cron-subagent-desktop.mp4](docs/internal/ui/cockpit/media/openclaw-cron-subagent-desktop.mp4)

## What you get

- Governed execution tiers: `Auto`, `Assisted`, `Human-approve`, `Manual-only`
- Explicit approvals and workspace-scoped operations
- Evidence-first operation history for audit and review
- Ports/adapters integration model for existing systems of record
- A control-plane layer that can sit above agents instead of replacing them

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

## Working with Calvin

Portarium is also the architecture Calvin uses to think about governed AI consulting work: not "replace your team with agents," but "put policy, approvals, and evidence in the execution path so automation can survive production reality."

If you are exploring governed agent workflows, approvals, or control-plane architecture, start with the docs here and then reach out through Calvin Kennedy's consulting page.

## Discoverability topics

Use these repository topics for GitHub discoverability:

- `control-plane`
- `ai-governance`
- `agent-safety`
- `human-in-the-loop`
- `policy-engine`
- `approval-workflows`
- `openclaw`
- `robotics-governance`
- `enterprise-security`
- `risk-controls`

## License

Released under the MIT License. See `LICENSE`.
