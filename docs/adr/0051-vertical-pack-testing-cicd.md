# ADR-0051: Vertical Pack Testing and CI/CD

## Status

Accepted

## Context

Packs ship as versioned artefacts with schema extensions, workflow definitions, and connector mappings. Without automated testing, schema drift, workflow regressions, and connector breakage become inevitable as packs and vendor APIs evolve.

## Decision

Make packs "shippable units" with their own CI pipeline:

- Schema compatibility checks (diff + rule enforcement against the previous version).
- Workflow simulation tests (fixture events in, expected tasks/evidence out).
- Connector contract tests using vendor OpenAPI specs or official documentation where available.
- Conformance tests to interoperability standards where applicable (e.g., OneRoster conformance for education).

Every pack version must pass its full test suite before registry publication. Test assets (fixtures, contracts) are distributed as part of the pack artefact.

## Consequences

- Reduces production regressions; enables safe upgrades
- Test infrastructure cost (sandboxes, fixtures, compliance data sets)
- Conformance tests provide credibility for standards-aligned verticals
- Schema compatibility checker must be built as core tooling

## Alternatives Considered

- **Only manual QA** -- too slow as packs proliferate
- **Only unit tests** -- insufficient for integration semantics
