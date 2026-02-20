# ADR-0049: Vertical Pack Data Storage and Tenancy Isolation

## Status

Accepted

## Context

Pack-extended data must be stored alongside core data with proper tenant isolation. Different tenants may have different compliance requirements (e.g., education with child data protections vs hospitality with PCI boundaries). A one-size-fits-all isolation model either over-engineers for simple cases or under-protects regulated ones.

## Decision

Default to a tenant-scoped shared storage model with explicit isolation tiers:

- **Tier A:** shared database, tenant scoping enforced at the data access layer (default).
- **Tier B:** schema-per-tenant for higher isolation.
- **Tier C:** database-per-tenant for regulated/high-value tenants.

Pack-extended fields and entity types are stored in the same tenant-scoped storage, namespaced by pack. The isolation tier is configurable per tenant and enforced by core -- packs are isolation-tier-agnostic. Data retention policies from ADR-028 apply to pack data equally.

## Consequences

- Practical default while allowing contractual upgrades for stricter regimes.
- Multiple tiers increase operational complexity.
- Must avoid "second-class citizen" support for higher tiers.
- Pack data benefits from core evidence and audit trail automatically.

## Alternatives Considered

- **Always database-per-tenant** -- strong isolation but expensive and hard to operate at scale.
- **Always shared** -- cheapest but may fail regulatory and customer expectations.

## Implementation Mapping

- Closed baseline implementation:
  - `bead-0335`
- Closed tenant-isolation verification:
  - `bead-0195`
  - `bead-0196`
- Remaining Tier B/C migration and automation gaps:
  - `bead-0391`
  - `bead-0392`
- ADR closure implementation mapping bead:
  - `bead-0597`
- ADR linkage verification review bead:
  - `bead-0598`

## Evidence References

- `src/infrastructure/postgresql/postgres-json-document-store.ts`
- `src/infrastructure/postgresql/postgres-store-adapters.ts`
- `src/infrastructure/postgresql/postgres-store-adapters.integration.test.ts`
- `src/infrastructure/testing/tenant-isolated-port-fixtures-v1.ts`
- `src/infrastructure/testing/tenant-isolated-port-fixtures-v1.test.ts`
- `docs/review/bead-0597-adr-0049-implementation-mapping-review.md`
- `docs/review/bead-0598-adr-0049-linkage-review.md`
