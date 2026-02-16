# ADR-0040: Versioned Vertical Packs (Manifest + Registry + Resolver)

## Status

Accepted

## Context

Portarium is a horizontal control plane (workflows, policy/approvals, audit/evidence, connectors). We need a disciplined way to ship high-variation domain behavior without bloating or forking the core.

ADR-0039 already establishes a “reference vertical package” for software change management. This ADR formalises that “vertical package” concept into a general mechanism: versioned, declarative packs that can be enabled per tenant at pinned versions with compatibility enforcement.

## Decision

Introduce **Vertical Packs** as versioned, declarative bundles loaded through a stable core extension contract.

1. **Pack artefact**
   - A pack is distributed as an artefact (directory or archive) containing a `pack.manifest.json` plus referenced assets.
   - Packs are treated as configuration/data, not arbitrary executable code.

2. **Manifest-based contracts**
   - Every pack ships a `pack.manifest.json` with:
     - `id` (namespaced identifier, e.g. `scm.change-management`)
     - `version` (SemVer)
     - `requiresCore` (SemVer range, same core major series)
     - `dependencies` (pack id -> SemVer range)
     - `assets` (schemas, workflows, UI templates, mappings, test assets)

3. **Registry + resolver**
   - A **Pack Registry** provides available pack versions and manifests.
   - A **Pack Resolver**:
     - resolves pack dependencies,
     - enforces `requiresCore` compatibility,
     - pins versions into a tenant-scoped lockfile.
   - The initial resolver is greedy and fails fast on dependency conflicts; backtracking resolution can be added later if needed.

4. **Tenant pinning**
   - Tenants enable one or more packs and operate on pinned pack versions (recorded in a lockfile).
   - Upgrades are explicit changes to the lockfile, with validation before applying.

## Consequences

- Core stays small and stable; vertical variation is packaged and versioned independently.
- Supportability improves via explicit compatibility rules and per-tenant pinning, at the cost of a new lifecycle surface (registry, resolver, upgrade tooling).
- Pack contracts must be treated as product APIs: versioned, tested, and deprecation-managed.
