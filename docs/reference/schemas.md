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
- `EngineeringEvidenceCardInputV1`
- `LocationEventV1`
- `MapLayerV1`

## Engineering R&D Contracts

- `EngineeringEvidenceCardInputV1` lives in
  `src/domain/evidence/engineering-evidence-card-v1.ts`.
- It is a docs/test-only static input contract for prompt-language Harness Arena
  evidence cards.
- `EngineeringEvidenceCardCockpitExportV1` lives in
  `src/domain/evidence/engineering-evidence-card-cockpit-export-v1.ts`.
- It is a docs/test-only static Cockpit export contract for already-validated
  engineering evidence-card inputs.
- It is not wired to runtime ingestion, Cockpit live cards, storage, or approval
  execution.

## Change policy

1. Update spec source first.
2. Update implementation and tests.
3. Update docs references.
4. Run `npm run ci:pr`.
