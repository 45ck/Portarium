# Portarium Project Scope

This page separates the core Portarium product from adjacent experiments and future work. The Beads backlog contains both; open Beads do not all mean the core control plane is unfinished.

## Core Product

Portarium is the governance layer between AI workers and real systems. The core product succeeds when agents can propose real tool actions, Portarium can govern those actions, and the repo can prove the behavior with repeatable tests.

The core product is:

- Control-plane API for Workspaces, Runs, Approvals, Policies, Evidence, Work Items, and agent action proposals.
- Policy enforcement with execution tiers: `Auto`, `Assisted`, `Human-approve`, and `Manual-only`.
- Human approval flow with Plan context, decision records, and maker-checker constraints.
- Evidence and audit trail for what was proposed, approved, executed, denied, or blocked.
- Tenant/workspace isolation, RBAC, auth boundaries, and production startup gates.
- Adapter/port architecture so existing Systems of Record remain authoritative.
- SDK and integration surface so agents and external tools can call Portarium.
- Cockpit as a reference operator UI for approvals, policies, runs, and evidence.

## Core Success Bar

The minimum credible product is not a large library of example businesses. It is a small, reliable governance loop:

1. An agent proposes an action through the SDK, plugin, or HTTP API.
2. Portarium classifies the action by policy and execution tier.
3. Safe actions can proceed; gated actions create an approval; blocked actions do not run.
4. A human can approve or deny with enough context to make the decision.
5. Approved actions execute through a controlled runner or adapter.
6. The decision, evidence, and result are recorded and queryable.
7. Automated tests prove the allowed, approval-required, denied, blocked, retry, and isolation paths.

Anything outside that loop is only core if it makes the loop safer, more reliable, or easier to verify.

## Core Status

Substantial core functionality is already present:

- Domain models, parsers, contracts, and tests exist for the main governance objects.
- Approval and agent-action flows are implemented and covered by tests.
- OpenClaw/plugin integration exists for governed tool calls.
- Cockpit has working operator and approval surfaces.
- Postgres stores, migrations, health checks, rate limiting, metrics, and deployment scaffolding exist.
- TypeScript SDK coverage has been expanded.

The remaining core work should stay focused on production readiness:

- Fix fail-closed paths where missing dependencies or failed hooks could otherwise permit unsafe behavior.
- Close security hardening gaps around plugin config, headers, metrics, ownership checks, error details, JWT requirements, and rate limiting.
- Finish release hygiene: SDK publishing, migration runner closeout, gate baseline, and green `npm run ci:pr`.
- Keep Cockpit focused on the reference flows required to test and operate approvals, policies, runs, and evidence.

## Future Work

The following are useful directions, but they are not required for the core Portarium control plane to be considered usable.

### Growth Studio

Autonomous B2B Growth Studio, prospect research, content creation, outreach execution, campaign measurement, dashboards, live demo recordings, and sample ICP/content templates are showcase work. They prove Portarium can govern a business loop, but they are not part of the core platform.

### Mission Control UI

The mission-control-ui research, theme convergence, three-panel engineering shell, Bead thread panel, diff approval surface, and advanced operator cockpit concepts are future product experience work. The core only needs a clear reference UI for approvals, policies, runs, and evidence.

### Prompt-Language Workflows

Prompt-language exploration for governed coding workflows is an experimental future layer. It should remain separate until the core governance model is stable and the Growth Studio evidence gate proves the need.

### Pilot And Operator Research

Pilot readiness, usefulness scorecards, trust calibration, approval-fatigue studies, operator onboarding, and incident playbooks are go-to-market and adoption work. They are valuable before larger deployments, but they should not block the core technical release.

### Advanced Governance Programs

Delegated autonomy hierarchy, autonomy budgets, policy-learning telemetry, shift-aware routing, approval-to-policy conversion, legal hold expansion, and large operator-plugin ecosystems are post-core maturity work.

### Demo And Media Tooling

Demo-machine integration, weekly autonomy digests, multi-project showcases, and generated media artifacts are presentation and enablement work. They should be tracked as examples or future demos, not core blockers.

## Rule Of Thumb

A backlog item is core if Portarium would be unsafe, unable to run, or unauditable without it.

A backlog item is also core if it is required to prove the agent governance loop works in automated tests.

A backlog item is future work if it makes Portarium more impressive, broader, easier to sell, easier to operate at scale, or useful for a specific showcase, but the tested agent governance loop still works without it.
