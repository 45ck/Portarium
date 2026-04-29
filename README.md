# Portarium

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner.dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="assets/banner.light.png" />
    <img src="assets/banner.light.png" alt="Portarium banner" width="100%" />
  </picture>
</p>

**Let AI agents do real work. Keep humans, policy, and evidence in control.**

[![CI (PR)](https://github.com/45ck/Portarium/actions/workflows/ci.yml/badge.svg)](https://github.com/45ck/Portarium/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/45ck/Portarium/branch/main/graph/badge.svg)](https://codecov.io/gh/45ck/Portarium)
[![Storybook](https://github.com/45ck/Portarium/actions/workflows/chromatic.yml/badge.svg)](https://github.com/45ck/Portarium)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Portarium is an open-source control plane for AI agents. Agents propose tool actions. Portarium checks policy, asks for human approval when needed, executes through controlled adapters, and records evidence so every decision can be tested, reviewed, and audited.

The practical goal is simple: you should be able to leave an agent working, know what it is allowed to do, and review the decisions that need you from a phone or web app without digging through logs.

## Why It Exists

Most agent demos let the agent call tools directly. That is fine for a prototype, but production teams need clear answers:

- Was this action allowed by policy?
- Did it need human approval?
- Who approved or denied it?
- What evidence existed at the time?
- What actually executed?
- Can we prove the safe, denied, retry, and isolation paths still work?

Portarium is built around that governance loop.

## The Core Loop

```text
Agent proposes action
        |
        v
Portarium checks policy
        |
        +--> allow and execute
        +--> ask for human approval
        +--> deny or block
        |
        v
Evidence, result, and timeline are recorded
```

The core product is successful when automated tests prove that agents can route actions through this loop and Portarium enforces the expected behavior.

## What You Get

- **Policy gates for agents**: `Auto`, `Assisted`, `Human-approve`, and `Manual-only`
- **Human approval flow**: rich context before risky actions run
- **Mobile-friendly review**: approve or reject agent decisions from the Cockpit reference UI
- **Evidence trail**: proposed action, decision, execution result, and audit record stay linked
- **Controlled execution**: adapters and action runners call external systems instead of agents using unchecked credentials
- **SDK and API**: agents, plugins, and tools can integrate through stable interfaces
- **Reference Cockpit UI**: operator screens for approvals, policies, runs, and evidence
- **Repeatable tests**: scenarios cover allowed, approval-required, denied, blocked, retry, and isolation paths

## Architecture

<p align="center">
  <img src="docs/diagrams/generated/09_isometric_minimal_fusion_textonly_v3_user_left.jpg" alt="Portarium architecture overview" />
</p>

Portarium sits between agents and the systems they want to touch:

1. An agent proposes an action through the SDK, plugin, or HTTP API.
2. Portarium classifies the action using policy, risk, workspace, identity, and capability context.
3. Safe actions can run. Risky actions wait for approval. Blocked actions do not run.
4. Approved actions execute through a controlled runner or adapter.
5. The decision, evidence, and result are recorded for review and testing.

## Showcase

### Cockpit Approvals

<p align="center">
  <img src="docs/internal/ui/cockpit/media/approvals-v2-showcase.gif" alt="Cockpit approvals queue and approval detail" />
</p>

### OpenClaw Mobile Approval

<p align="center">
  <a href="docs/internal/ui/cockpit/media/openclaw-tinder-approvals-iphone.mp4">
    <img src="docs/internal/ui/cockpit/media/openclaw-tinder-approvals-iphone.gif" alt="Mobile approval flow for OpenClaw actions" width="320" />
  </a>
</p>

### Destructive Action Blocked

<p align="center">
  <img src="docs/internal/ui/cockpit/media/openclaw-destructive-blocked-desktop.gif" alt="Desktop governance clip showing a destructive action blocked by policy" />
</p>

More demo commands and media live in [docs/how-to/run-cockpit-demos-locally.md](docs/how-to/run-cockpit-demos-locally.md).

## Quickstart

Prerequisites:

- Node.js `^20.19.0` or `>=22.12.0`
- Docker and Docker Compose
- Git

```bash
git clone https://github.com/45ck/Portarium.git
cd Portarium
npm ci
npm run dev:all
npm run dev:seed
curl -s http://localhost:8080/healthz
```

Run the quickest governed-flow check:

```bash
npm run smoke:governed-run
```

For the guided path, use [Hello Portarium](docs/getting-started/hello-portarium.md).

## Documentation

Start here: [docs/index.md](docs/index.md)

If you only read one page next: `docs/index.md`

Evaluate in 15-30 min: `docs/getting-started/hello-portarium.md`

| Need                         | Go to                                                                    |
| ---------------------------- | ------------------------------------------------------------------------ |
| Understand the product       | [Project overview](docs/project-overview.md)                             |
| Know what is core vs future  | [Project scope](docs/project-scope.md)                                   |
| Run locally                  | [Local development](docs/getting-started/local-dev.md)                   |
| Test the governance loop     | [Hello governed workflow](docs/tutorials/hello-governed-workflow.md)     |
| Trace evidence               | [Evidence trace tutorial](docs/tutorials/evidence-trace.md)              |
| Understand the architecture  | [Architecture](docs/explanation/architecture.md)                         |
| Integrate an agent or system | [Agent traffic controller](docs/explanation/agent-traffic-controller.md) |
| Use the HTTP API             | [HTTP API reference](docs/reference/http-api.md)                         |
| See changes                  | [Changelog](docs/changelog.md)                                           |
| Contribute                   | [CONTRIBUTING.md](CONTRIBUTING.md)                                       |
| Get support                  | [SUPPORT.md](SUPPORT.md)                                                 |
| Report security issues       | [SECURITY.md](SECURITY.md)                                               |

## Project Status

Portarium is early and actively built. The core control-plane foundations are present: domain contracts, approval flows, policy tiers, evidence, OpenClaw/plugin integration, SDK surfaces, Cockpit reference UI, tests, migrations, and production scaffolding.

Remaining core work is mostly production hardening, security closeout, release hygiene, mobile-friendly Cockpit approval review, and keeping the tested agent-governance loop reliable. Larger demos, Growth Studio, mission-control UI, prompt-language experiments, and pilot research are future work, not core blockers.

See [project scope](docs/project-scope.md) and [roadmap](docs/roadmap.md).

## Contributing

Portarium is MIT-licensed open source. Contributions are welcome when they make the tested agent-governance loop safer, clearer, easier to run, or easier to verify.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

## Community

- Questions and ideas: [GitHub Discussions](https://github.com/45ck/Portarium/discussions)
- Bugs and feature requests: [GitHub Issues](https://github.com/45ck/Portarium/issues/new/choose)
- Security reports: [GitHub Security Advisories](https://github.com/45ck/Portarium/security/advisories/new)
- Support guide: [SUPPORT.md](SUPPORT.md)

## License

Released under the [MIT License](LICENSE).
