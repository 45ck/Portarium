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
