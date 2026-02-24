# ADR-0047: Vertical Pack Workflow Extension and Composition

## Status

Accepted

## Context

Vertical packs add domain-specific workflow steps (validations, transformations) to the core workflow runtime. Workflows must compose cleanly across core steps (approval gates, evidence capture, connector invocation) and pack steps without tight coupling.

## Decision

Treat workflows as composable graphs composed of:

- **Core steps:** identity checks, approval gates, evidence capture, connector invocation, retry/backoff.
- **Pack steps:** domain validations, entity-specific transformations.
- **System-of-record mappings:** connectors.

Workflow composition is event-driven: core emits domain-agnostic events (e.g., `record.created`, `approval.granted`, `connector.sync.requested`). Packs subscribe to events and attach additional steps, with strict ordering rules enforced by the workflow runtime. Pack-provided workflow definitions are declarative and executed by the core runtime -- packs do not contain arbitrary executable code.

## Consequences

- Re-uses core workflow runtime; keeps domain logic declarative; supports cross-pack workflows.
- Debugging becomes harder without good observability (mitigated by OpenTelemetry, ADR-033).
- Ordering and conflict resolution between pack event handlers must be governed.
- Enables workflow templates that tenants can customise within pack-defined boundaries.

## Alternatives Considered

- **Copy workflows per vertical** -- leads to drift and duplicated fixes.
- **Permit arbitrary code in packs** -- faster but undermines safety model and supportability.
