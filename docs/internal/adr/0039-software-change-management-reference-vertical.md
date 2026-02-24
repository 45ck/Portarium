# ADR-0039: Software Change Management Reference Vertical

## Status

Accepted

## Context

Portarium needs a compelling reference implementation to demonstrate end-to-end value. Software change management is an ideal candidate: it spans multiple tools (ticketing, version control, CI/CD, code review, deployment), involves multiple stakeholders, requires approvals and evidence, and is a pain point for every engineering team.

## Decision

Provide a reference vertical package for software change management that demonstrates the full Portarium loop:

1. **Ticket** -- ingested from Jira/Linear/GitHub Issues via CustomerSupport or ProjectsWorkMgmt port.
2. **Plan** -- generated describing the intended code change, tests, and deployment steps.
3. **Code-agent machine** -- produces code changes via Claude Code, Codex, or similar AI coding agents.
4. **PR/CI** -- pull request created, CI pipeline triggered and monitored.
5. **Approval** -- human review of Plan + PR diff via Portarium approval gate.
6. **Demo machine** -- generates MP4 proof-of-working or screenshot evidence.
7. **Merge/Deploy** -- approved changes merged and deployed.
8. **Evidence** -- full chain recorded: ticket link, plan, code diff, CI results, approval decision, demo artifact, deployment confirmation.

This is a reference package, not a required vertical. It demonstrates Portarium's capabilities and serves as a template for other verticals.

## Consequences

- Provides a concrete, relatable demonstration of Portarium's value.
- Exercises most platform capabilities (ports, machines, approvals, evidence, policies).
- Creates reusable patterns for other verticals.
- Requires maintained adapters for at least one ticketing tool, one VCS, and one CI system.
