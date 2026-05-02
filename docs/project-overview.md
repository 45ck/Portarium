# Portarium Project Overview

Portarium is an open-source control plane for governed AI agents.

Agents can plan and propose actions, but Portarium decides what is allowed to run, what needs human approval, what must be blocked, and what evidence must be recorded.

## One-Sentence Version

Portarium lets teams give AI agents real tools without giving them unchecked power.

In practical terms: leave an agent running, know what it is capable of, and handle the decisions that need you from a phone or web app.

## What Portarium Does

Portarium sits between agent runtimes and the systems those agents want to touch.

It provides:

- policy checks before tool actions run
- execution tiers for safe, assisted, approval-required, and manual-only work
- approval queues for risky actions
- mobile-friendly Cockpit review for approving or rejecting agent decisions
- controlled execution through adapters and action runners
- evidence records for proposals, decisions, results, and audit trails
- workspace isolation, RBAC, auth boundaries, and startup gates
- SDK and HTTP API surfaces for agents, plugins, and external tools
- Cockpit as a reference operator UI

## The Core Agent Governance Loop

The core product is a loop that can be tested repeatedly:

1. An agent proposes a tool action.
2. Portarium evaluates policy and classifies the action.
3. Safe actions proceed.
4. Risky actions wait for human approval.
5. Blocked actions do not run.
6. Approved actions execute through a controlled boundary.
7. Evidence and results are recorded.
8. Tests prove the behavior still works.

This loop is the product center. Example business workflows are valuable, but they are not the core unless they prove or harden this loop.

## What Is Already Present

- Domain models and contracts for Workspaces, Runs, Approvals, Policies, Evidence, Work Items, and agent action proposals.
- Approval and agent-action flows with tests.
- OpenClaw/plugin integration for governed tool calls.
- Cockpit reference UI for approval and operator workflows.
- Postgres stores, migrations, health checks, rate limiting, metrics, and deployment scaffolding.
- TypeScript SDK coverage for the control-plane API.
- Scenario tests for core governance behavior.

## Local Validation

The canonical local path is:

```bash
npm run dev:all
npm run dev:seed
npm run smoke:governed-run
```

Use this to prove the control plane, seeded demo data, and governed agent-action smoke path are working together.

## What Remains Core

The remaining core work should stay narrow:

- fail-closed behavior for missing dependencies or failed governance hooks
- security hardening around plugin config, headers, metrics, ownership checks, JWT config, error details, and rate limiting
- SDK publishing and release hygiene
- migration runner closeout
- green `npm run ci:pr`
- clear Cockpit reference flows for approvals, policies, runs, evidence, and mobile decision review

## What Is Future Work

The following are useful, but they should not be confused with core completion:

- software-first proving workflows such as Growth Studio, micro-SaaS, content, and media loops
- mission-control UI experiments
- prompt-language exploration
- pilot-readiness studies
- advanced delegated autonomy research
- demo-machine, media, and showcase tooling
- robotics and physical actuation expansion until hardware, safety, and release gates exist

See [project scope](project-scope.md) and [roadmap](roadmap.md).

## What Portarium Is Not

Portarium is not:

- a replacement for your CRM, ERP, helpdesk, or project-management system
- an agent runtime
- a generic workflow builder for every possible business process
- a promise of full autonomy

Portarium is the governance, approval, execution-boundary, and evidence layer above agents and existing systems.

## Main Docs

- [Docs index](index.md)
- [Project scope](project-scope.md)
- [Architecture](explanation/architecture.md)
- [Agent traffic controller](explanation/agent-traffic-controller.md)
- [Hello Portarium](getting-started/hello-portarium.md)
- [HTTP API reference](reference/http-api.md)
