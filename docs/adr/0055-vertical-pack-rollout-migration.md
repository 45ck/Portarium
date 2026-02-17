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
