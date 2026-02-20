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

## Implementation Mapping

- Closed implementation/review coverage:
  - `bead-0001`
  - `bead-0055`
  - `bead-0056`
- Follow-up implementation bead for lifecycle status and support-window enforcement:
  - `bead-0640`
- ADR closure implementation mapping bead:
  - `bead-0603`
- ADR linkage verification review bead:
  - `bead-0604`

## Evidence References

- `src/domain/packs/pack-manifest.ts`
- `src/domain/packs/pack-manifest.test.ts`
- `src/domain/packs/pack-resolver.ts`
- `src/domain/packs/pack-resolver.test.ts`
- `src/domain/packs/pack-registry.ts`
- `docs/vertical-packs/README.md`
- `docs/review/bead-0603-adr-0052-implementation-mapping-review.md`
