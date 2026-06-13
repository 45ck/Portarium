# ADR-0153: OpenClaw Adapter Surface Contract

**Status:** accepted
**Date:** 2026-06-13

## Context

Portarium already has OpenClaw integration code, release gates, policy
classifiers, Cockpit approval surfaces, and evidence paths. Downstream
deployments still need a generic way to prove their OpenClaw aliases, bridge
principals, approval-card flow, executor gate, evidence timeline, and Cockpit
visibility follow the same safety shape.

Without a shared adapter contract, each deployment can drift into its own tool
names, headers, approval semantics, or executor defaults. That makes reliability
hard to test and increases the chance that a customer-specific adapter weakens
Portarium's open-source governance loop.

## Decision

Add a tenant-neutral OpenClaw adapter contract:

- `examples/openclaw/portarium-openclaw-adapter.contract.json`
- `scripts/ci/check-openclaw-adapter-contract.mjs`
- `.specify/specs/openclaw-adapter-surface-v1.md`
- `docs/integration/openclaw-adapter-contract.md`

The contract separates read-only, standing-read, approval-drafting, and executor
principals. It requires approval-card drafting to be proposal-only, keeps the
executor direct-only and not chat-exposed, defaults executor calls to dry-run,
and requires evidence/result timeline and Cockpit visibility for blocked as well
as executed work.

## Consequences

- Portarium gains an upstream reusable OpenClaw adapter surface without adding a
  customer-specific public API.
- Downstream adapters can add stricter aliases and policies, but cannot weaken
  the executor, approval-card, evidence, or Cockpit visibility invariants.
- CI has a deterministic local check for adapter contract drift.
- Customer-specific hostnames, source scopes, approval tokens, secrets, and
  deployment topology remain outside the open-source core.

## References

- `.specify/specs/openclaw-adapter-surface-v1.md`
- `docs/integration/openclaw-adapter-contract.md`
- `docs/internal/governance/openclaw-release-gate.md`
- `docs/internal/adr/ADR-0118-agent-action-governance.md`
- `docs/internal/adr/ADR-0141-cockpit-portarium-plugin-extensibility.md`
