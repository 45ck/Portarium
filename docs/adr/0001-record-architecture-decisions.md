# ADR-0001: Record Architecture Decisions

## Status

Accepted

## Context

We need to record the architectural decisions made on the VAOP project so that current and future contributors can understand why the system is shaped the way it is.

## Decision

We will use Architecture Decision Records (ADRs), as described by Michael Nygard in his article "Documenting Architecture Decisions".

Each ADR is a short text file in `docs/adr/`. The file name convention is `NNNN-title-with-dashes.md` where NNNN is a zero-padded sequence number.

An ADR describes a single decision. It contains the following sections:

- **Status** -- Proposed, Accepted, Deprecated, or Superseded (with a link to the replacement).
- **Context** -- The forces at play, including technical, political, social, and project-specific constraints.
- **Decision** -- The change we are proposing or have agreed to implement.
- **Consequences** -- What becomes easier or harder as a result of this decision.

## Consequences

- Every significant architectural decision will be tracked and discoverable.
- New team members can read the ADR log to understand the rationale behind the current architecture.
- ADRs are immutable once accepted; if a decision changes, a new ADR supersedes the old one.
- The existing decisions in `docs/ADRs-v0.md` will be migrated into individual ADR files over time.
