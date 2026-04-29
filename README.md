# Portarium

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner.dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="assets/banner.light.png" />
    <img src="assets/banner.light.png" alt="Portarium banner" width="100%" />
  </picture>
</p>

**Let AI do the work. Keep humans in control.**

Portarium is an open-source safety and approval layer for AI workers. AI can draft, suggest, and prepare actions — but Portarium checks the rules, asks a human when needed, and keeps a full record of what happened.

[![CI (PR)](https://github.com/45ck/Portarium/actions/workflows/ci.yml/badge.svg)](https://github.com/45ck/Portarium/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/45ck/Portarium/branch/main/graph/badge.svg)](https://codecov.io/gh/45ck/Portarium)
[![Storybook](https://github.com/45ck/Portarium/actions/workflows/chromatic.yml/badge.svg)](https://github.com/45ck/Portarium)

## Why this exists

AI agents can plan, draft, and call tools. The hard part is production reality:

- who allowed this action?
- what rules were applied?
- what evidence existed at the time?
- what can be replayed, audited, or rolled back?

Most agent demos skip these questions. When they hit production, approvals are bolted on after the fact, evidence is fragmented, and nobody can explain who approved what or why.

Portarium closes that gap. It sits between AI and the systems AI wants to touch. The AI can still propose. Portarium decides whether the action is allowed, needs approval, or must be blocked — then keeps the paper trail.

## What Portarium does

- **Checks the rules** before AI is allowed to actually do anything
- **Risky actions still need human sign-off** — approval is built into the execution path, not bolted on
- **Everything is tracked** — you can always see what AI tried to do, what was approved, and what changed
- **Works with existing tools** — your current business software stays the system of record
- **Gradual trust** — start with full human oversight, widen autonomy as confidence grows

Portarium is not the agent. It is the layer that makes agents safe enough to trust with real work.

## How it works

<p align="center">
  <img src="docs/diagrams/generated/09_isometric_minimal_fusion_textonly_v3_user_left.jpg" alt="Portarium Architecture Overview" />
</p>

Portarium sits between people, AI agents, and the systems those agents want to touch:

1. **AI proposes an action** — "send this email," "update this record," "deploy this change."
2. **Portarium checks the rules** — is this allowed? Is it risky? Does it need a human?
3. **Safe actions proceed automatically.** Risky actions wait for human approval. Dangerous actions are blocked.
4. **Approved work executes** through connectors to existing business systems.
5. **Everything is recorded** — the decision, the evidence, and the outcome, linked together for review.

Agents can think and propose. Rules and approvals decide what actually happens.

## Before and after Portarium

| Without Portarium                           | With Portarium                                          |
| ------------------------------------------- | ------------------------------------------------------- |
| AI calls tools directly — hope for the best | AI submits intent; rules decide what actually runs      |
| Safety lives in the prompt                  | Safety is enforced before anything executes             |
| Approvals are ad hoc or absent              | Approval is a built-in step, not an afterthought        |
| Logs exist, but the story is fragmented     | Decision, action, and evidence stay linked together     |
| When something goes wrong, good luck        | Every action is reviewable, attributable, and auditable |

Not "perfect autonomy." Safe automation with visible boundaries.

## OpenClaw integration

OpenClaw is the AI worker. Portarium is the safety layer.

1. OpenClaw picks up a task or proposes an action.
2. Portarium checks the rules and assesses risk.
3. Low-risk work proceeds automatically.
4. Higher-risk work pauses for human approval.
5. Results, evidence, and decisions are returned to both the AI and the human operator.

OpenClaw shows that real business workflows can be automated. Portarium shows they can still be governed, reviewed, and constrained.

If you are building with AI agents, Portarium is the layer that keeps "helpful automation" from turning into "untraceable side effects."

## Feature showcase

### Approvals UX v2 (Cockpit)

<p align="center">
  <img src="docs/internal/ui/cockpit/media/approvals-v2-showcase.gif" alt="Approvals UX v2 showcase: pending queue, triage panel, and approval detail" />
</p>

Review pending AI actions, see why they need approval, decide yes or no, and keep the paper trail — all in one place.

### OpenClaw approvals on mobile

<p align="center">
  <a href="docs/internal/ui/cockpit/media/openclaw-tinder-approvals-iphone.mp4">
    <img src="docs/internal/ui/cockpit/media/openclaw-tinder-approvals-iphone.gif" alt="iPhone-style approval flow for OpenClaw actions: briefing first, policy-aware review, approve or deny decisions" width="320" />
  </a>
</p>

AI can propose work, but the rules decide what is auto-approved, what needs a human, and what is blocked entirely.

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

- **Gradual trust levels**: `Auto`, `Assisted`, `Human-approve`, `Manual-only` — start strict, widen as confidence grows
- **Built-in approvals** — risky actions wait for a human, not a prayer
- **Full paper trail** — every action, decision, and outcome is recorded and reviewable
- **Works with your existing tools** — Portarium connects to business systems without replacing them
- **Sits above any agent** — not a replacement for your AI, but the safety layer on top of it

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

Early and actively built. The core control-plane foundations are in place; remaining core work is mostly production hardening, security closeout, release hygiene, and reference UI polish. Several open backlog items are showcase or future-product directions rather than core blockers. See [project scope](docs/project-scope.md).

## Working with Calvin

Portarium is the architecture Calvin uses for governed AI consulting: not "replace your team with agents," but "make AI safe enough to trust with real business work."

If you are exploring AI automation with proper safety, approvals, and accountability, start with the docs here and then reach out through Calvin Kennedy's consulting page.

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
