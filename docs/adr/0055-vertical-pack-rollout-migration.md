# ADR-0055: Vertical Pack Rollout and Migration Strategy

## Status

Accepted

## Context

Pack enablement and upgrades must be safe, reversible, and staged. Tenants in regulated industries (education, finance) require change management processes. A "big bang" approach to pack rollout risks widespread failures.

## Decision

Roll out packs tenant-by-tenant. Enabling a pack is reversible at the UI layer (templates/workflows can be disabled) while data retention policies govern stored records.

Upgrades are staged:

- Patch versions auto-upgrade with rollback capability.
- Minor versions are opt-in per tenant (or auto for "fast ring" tenants) with compatibility checks and workflow simulation replay.
- Major versions require an explicit migration plan, conversion scripts, and staged rollout with canary tenants.

Every pack major bump must ship with automated or semi-automated migration tooling. A feature flag system controls pack visibility and activation per tenant.

## Consequences

- Contains blast radius; supports enterprise change management
- RC/staging overhead for each upgrade tier
- Requires robust migration tooling for major version bumps
- Feature flag system adds operational complexity but enables safe experimentation

## Alternatives Considered

- **Big-bang enablement for all tenants** -- high risk, unacceptable for regulated industries
- **No migration tooling** -- forces manual upgrades, doesn't scale

## Implementation Mapping

ADR-0055 rollout and migration strategy is implemented across tenant-scoped pack resolution and
schema migration orchestration:

- `bead-0001` (closed): versioned pack manifest/registry/resolver baseline.
- `bead-0309` (closed): tenant-scoped pack version resolution and lock materialization.
- `bead-0362` (closed): migration planning semantics for staged rollout and rollback safety.
- `bead-0377` (closed): migration executor behavior for expand/contract phases.
- `bead-0391` (closed): migration rollback and failure-path handling.
- `bead-0609` (closed): ADR-0055 implementation mapping closure.
- `bead-0610` (closed): ADR-0055 linkage verification review.

## Acceptance Evidence

- Tenant-scoped version/lock resolution:
  - `src/domain/packs/pack-resolver.ts`
  - `src/domain/packs/pack-resolver.test.ts`
- Expand/contract migration planning and rollback behavior:
  - `src/infrastructure/migrations/schema-migrator.ts`
  - `src/infrastructure/migrations/schema-migrator.test.ts`
  - `src/infrastructure/migrations/default-migrations.ts`
- Rollout policy/runbook context:
  - `docs/vertical-packs/README.md`
- Review linkage:
  - `docs/review/bead-0609-adr-0055-implementation-mapping-review.md`
  - `docs/review/bead-0610-adr-0055-linkage-review.md`

## Remaining Gap Tracking

- `bead-0644`: tenant-ring promotion orchestration, canary rollback triggers, and major-version
  migration execution hooks.
