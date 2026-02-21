# ADR-0078: Agentic Workflow Cockpit Reuse vs Build Strategy

**Beads:** bead-0749
**Status:** Accepted
**Date:** 2026-02-21

## Context

Portarium is a governance-first Control Plane with strong requirements for Workspace tenancy,
RBAC, Approval Gate enforcement, Evidence Log integrity, and durable workflow orchestration.

For a customer-facing cockpit, importing a full external workflow product can accelerate demos
but usually introduces hard coupling around:

- identity and tenancy models,
- credential storage boundaries,
- policy and approval semantics,
- evidence/audit models,
- long-running execution assumptions,
- product licensing constraints.

We need a strategy that protects Portarium domain semantics while still reusing mature
execution primitives where practical.

## Decision

Adopt a hybrid strategy:

1. Build a Portarium-native cockpit and control-plane UX

- Keep Work Item, Run, Approval, Policy, and Evidence views native to Portarium.
- Keep control-plane contracts and Workspace isolation authoritative inside Portarium.

2. Reuse permissively licensed execution primitives, not whole product shells

- Prefer reusable infrastructure/runtime components for durable execution and agent flow
  orchestration.
- Keep them behind Portarium ports/adapters and policy boundaries.

3. Treat restrictive or unavailable-licence platforms as explicit commercial decisions

- Do not copy/fork/import code from repositories without an explicit compatible licence grant.
- For source-available products with embedding restrictions, treat adoption as a separate
  licensing track with explicit business approval.

## Consequences

Positive:

- Preserves Portarium control-plane semantics and governance posture.
- Reduces legal and monetisation risk from restrictive upstream licences.
- Improves long-term product differentiation and UX consistency.

Negative:

- Slower initial delivery than full-platform embedding for workflow editing UX.
- Requires dedicated implementation for cockpit information architecture and API compatibility.
- Introduces ongoing responsibility for integration and runtime operations.

## Alternatives Considered

- Full platform import/fork as primary cockpit.
  - Rejected for default path due to licensing uncertainty/risk and domain-model coupling.
- Build all runtime primitives from scratch.
  - Rejected for v1 due to avoidable execution-engine complexity and slower delivery.

## Implementation Mapping

This ADR is implemented/planned through:

- `bead-0749` (this decision record)
- `bead-0750` (licensing gate checklist)
- `bead-0751` (cockpit IA baseline)
- `bead-0752` (cockpit/control-plane API compatibility layer)
- `bead-0753` (evaluate n8n Embed vs native editor path)
- `bead-0754` (credential boundary model)
- `bead-0755` (supply-chain guardrails)
- `bead-0756` (execution durability blueprint)
- `bead-0757` (MVP milestones and decision gates)

## Acceptance Evidence

- ADR document: `docs/adr/0078-agentic-workflow-cockpit-reuse-vs-build-strategy.md`
- Claimed bead record: `.beads/issues.jsonl` entry for `bead-0749`
- Licensing gate checklist: `docs/governance/third-party-workflow-ui-license-gate.md`

## Remaining Gap Tracking

- Licensing/commercial embedding path decision remains open under `bead-0753`.
- Control-plane compatibility adapter remains open under `bead-0752`.
- Cockpit IA implementation remains open under `bead-0751`.
