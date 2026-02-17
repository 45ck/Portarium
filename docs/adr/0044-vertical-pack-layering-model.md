# ADR-0044: Vertical Pack Layering Model: Microkernel Core + Governed Packs

## Status

Accepted

## Context

Portarium is a horizontal control plane (workflows, policy/approvals, audit/evidence, connectors). Domain-specific behaviour for industries like education or hospitality should not pollute the core. A microkernel-style architecture keeps a minimal core stable and extends functionality via plug-ins through a defined interface and registry.

## Decision

Implement a core microkernel-style platform with a stable extension contract and a registry/resolver that loads vertical packs as declarative configuration rather than arbitrary code.

- The core owns invariants: tenancy, identity, workflow runtime, policy enforcement, audit/evidence, and connector execution runtime.
- Packs own domain schema additions, workflow definitions, UI templates, and connector mappings.
- Packs are loaded through a Pack Registry that resolves versions per tenant and enforces compatibility.
- No pack may override core invariants.

## Consequences

- Lower coupling between core and domain; independent evolution; clearer governance boundaries.
- Requires rigorous extension contract design before first pack ships.
- Adds a registry/resolver operational component.
- Enables third-party pack development in future.

## Alternatives Considered

- **Monolithic "one schema fits all" core** -- accumulates domain complexity, makes change risky.
- **Separate product per vertical** -- faster early but fragments engineering, audit, and connector runtimes.
