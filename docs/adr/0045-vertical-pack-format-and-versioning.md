# ADR-0045: Vertical Pack Format and Versioning

## Status

Accepted

## Context

Vertical packs must be distributable, versionable, and auditable artefacts. Tenants pin pack versions and upgrade on their own schedule. Vendor APIs and standards evolve, so packs must express compatibility ranges clearly.

## Decision

Define a pack artefact with the following structure:

- A signed manifest containing metadata, compatibility range, dependencies, provenance, and a checksum list.
- Schema modules (JSON Schema or equivalent).
- Workflow definitions.
- UI templates and theme tokens.
- Connector mapping definitions and transformation rules.
- Test assets (fixtures, contracts).

Use semantic versioning: Major = breaking schema/workflow contract changes; Minor = additive backwards-compatible; Patch = bugfix or non-breaking adjustments. Each tenant has a "pack lockfile" storing enabled pack IDs and exact versions. Pack artefacts are signed and carry provenance metadata (builder, commit, test results).

## Consequences

- Predictable upgrades; supports version pinning; easier support boundaries.
- Requires discipline and tooling (linters, diff tools, policy checks).
- Enables reproducible tenant environments.
- Pack registry becomes a critical operational component.

## Alternatives Considered

- **Date-based versions (2026.02)** -- works for cadence but doesn't imply compatibility risk.
- **"Latest always"** -- operationally unsafe for tenants.
