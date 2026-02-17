# ADR-0046: Vertical Pack Schema Extension Mechanism

## Status

Accepted

## Context

Packs add domain-specific entity types and fields to the core model. Without clear rules, schema collisions, naming conflicts, and breaking changes become inevitable -- especially when tenants enable multiple packs simultaneously.

## Decision

Use a namespaced schema extension model.

- Core schemas are immutable within a core major series.
- Packs add new entity types and new fields via extension points, with every pack field namespaced (e.g., `edu.*`, `hospo.*`, `trade.*`).
- Every controlled vocabulary/enum is namespaced and mappable via a descriptor mapping subsystem.
- Compatibility rules: additive changes only in minor versions; removals/renames only in major versions; deprecations require a minimum deprecation window (one minor cycle).
- Core defines base extension points: Person, Organisation, Location, Asset, Transaction, Event, PolicyObject, EvidenceObject.

## Consequences

- Avoids collisions; enables multiple packs concurrently; makes migrations explicit.
- Requires runtime support for mapping descriptors/values between contexts and SoRs.
- Schema tooling (diff, compatibility checker) must be built before first pack ships.
- Descriptor mapping subsystem adds complexity but mirrors real-world standards practice (e.g., Ed-Fi descriptor namespaces).

## Alternatives Considered

- **One shared global enum space** -- creates conflicts across regions/vendors.
- **Pack-specific databases with no shared schema** -- avoids collisions but blocks cross-domain reporting.
