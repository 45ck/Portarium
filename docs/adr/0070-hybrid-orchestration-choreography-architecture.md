# ADR-0070: Hybrid Orchestration/Choreography Architecture

**Beads:** bead-0452
**Status:** Accepted
**Date:** 2026-02-20

## Context

Portarium coordinates long-running business operations with strong governance requirements:

- durable run lifecycle control (retries, timers, approvals, resumptions),
- tenancy isolation and policy enforcement,
- append-only evidence and auditability,
- downstream integrations that react to business events.

Earlier ADRs already establish:

- Temporal as the durable workflow engine for run orchestration (ADR-0065),
- CloudEvents as the external event envelope (ADR-0032).

What remained ambiguous was architectural intent at system level: whether Portarium is purely orchestrated, purely choreographed, or explicitly hybrid.

## Decision

Portarium adopts a **hybrid orchestration/choreography architecture**:

1. **Temporal orchestration for internal run lifecycle correctness**

- Temporal is authoritative for internal execution state transitions of runs and approvals.
- Control-plane invariants (policy tiers, SoD, idempotency, evidence sequencing) are enforced in the orchestrated path.
- Orchestration is the source of truth for command-side workflow progression.

2. **CloudEvents choreography for external projection and integration**

- Domain outcomes are emitted as CloudEvents for downstream consumers.
- Consumers build projections, notifications, analytics, and external automations asynchronously.
- External consumers do not drive internal run-state correctness directly.

3. **Clear boundary between the two**

- Internal correctness path: command -> orchestrated execution -> persisted state/evidence.
- External integration path: emitted CloudEvents -> subscriber-specific processing.
- Failures in subscribers must not corrupt or roll back run-lifecycle correctness.

## Architectural Pattern

- **Inside Portarium (orchestration):**
  - deterministic workflow progression and recovery,
  - policy and approval gating before side effects,
  - evidence chain continuity.
- **Outside Portarium (choreography):**
  - eventually consistent read models and integrations,
  - additive subscriber evolution,
  - independent failure domains.

## Consequences

**Positive:**

- Preserves correctness and governance in a single durable control path.
- Enables broad integration without coupling run lifecycle to subscriber availability.
- Supports independent scale and evolution for external consumers.

**Trade-offs:**

- Requires disciplined boundary design to prevent state authority drift.
- Introduces eventual consistency for read models fed from event streams.
- Demands explicit idempotency and replay handling in subscriber systems.

## Guardrails

- Internal run status authority remains in orchestrated storage, not event projections.
- CloudEvents are integration contracts, not command replacements for lifecycle-critical transitions.
- Subscriber side effects are treated as independently recoverable and idempotent.
