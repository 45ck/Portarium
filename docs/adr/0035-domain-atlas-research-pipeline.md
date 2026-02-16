# ADR-0035: Domain Atlas Research Pipeline

## Status

Accepted

## Context

VAOP's integration catalog covers 150+ SoR providers across 18 port families. Domain models, API surfaces, and entity structures change as vendors evolve. One-time research becomes stale quickly, and manual updates don't scale.

## Decision

Maintain a Domain Atlas as a structured research artifact with a re-runnable extraction pipeline:

- **CIF (Canonical Integration Format) snapshots** anchored to upstream API specification commits or version numbers.
- **Explicit mappings** from vendor entities to VAOP canonical objects.
- **Executable contract tests** generated from CIF snapshots to validate adapter conformance.
- **License classification** as an intake step for any new provider.

The Domain Atlas is versioned alongside the codebase and updated as part of the adapter development lifecycle.

## Consequences

- Prevents one-off research from going stale.
- Keeps model evolution auditable and regenerable.
- Adds a maintenance burden: the extraction pipeline must be kept running.
- Contract tests generated from CIF provide a safety net for adapter drift.
