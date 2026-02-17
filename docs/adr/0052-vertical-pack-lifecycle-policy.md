# ADR-0052: Vertical Pack Support and Lifecycle Policy

## Status

Accepted

## Context

Without explicit lifecycle rules, the support matrix explodes: many verticals times versions times connectors times tenant configurations. Education and hospitality standards themselves publish versions and expect implementers to align, demonstrating the need for clear lifecycle governance.

## Decision

Publish an explicit support policy:

- Core supports one current minor and one previous minor within a major series (N and N-1).
- Packs have LTS channels where specific versions are supported for a fixed window (minimum 12 months for stable, 6 months for current).
- Connector modules are versioned independently; deprecation notice periods are minimum one minor cycle.
- A pack catalogue tracks statuses: experimental, beta, stable, LTS, deprecated, end-of-life.
- The registry enforces lifecycle gates (e.g., block enabling deprecated packs for new tenants).

## Consequences

- Prevents endless backport support; creates predictable upgrade motions
- Requires product discipline and customer communication
- Registry-enforced lifecycle gates prevent accidental use of unsupported versions
- Two supported pack trains per vertical (Stable/LTS + Current) is the practical baseline

## Alternatives Considered

- **"Support everything forever"** -- operationally untenable
- **"Support only latest"** -- breaks enterprise and school adoption patterns
