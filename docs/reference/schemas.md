# Reference: Schemas

Portarium contracts are versioned and source-controlled.

## Primary schema sources

- OpenAPI: `docs/spec/openapi/portarium-control-plane.v1.yaml`
- Specification set: `.specify/specs/`
- Domain object references: `docs/domain/`

## Common versioned objects

- `WorkItemV1`
- `RunV1`
- `ApprovalV1`
- `PlanV1`
- `EvidenceEntryV1`
- `LocationEventV1`
- `MapLayerV1`

## Change policy

1. Update spec source first.
2. Update implementation and tests.
3. Update docs references.
4. Run `npm run ci:pr`.
