# Bead-0059 Review: Per-Family Operation Contract Stubs

## Scope

- Convert integration-catalog `Port Operations` tables into machine-readable fixtures for all 18 standard families.
- Ensure fixtures are testable and validated in repository test suite.

## Implementation

- Added generator:
  - `scripts/domain-atlas/generate-operation-contract-stubs.mjs`
- Added npm command:
  - `domain-atlas:ops-stubs`
- Wired command into:
  - `domain-atlas:ci`
- Added fixture coverage test:
  - `src/infrastructure/domain-atlas/operation-contract-stubs.test.ts`
- Generated outputs:
  - `domain-atlas/fixtures/operation-contract-stubs/*.operations.stub.json`
  - `domain-atlas/fixtures/operation-contract-stubs/index.json`

## Documentation Updates

- `docs/research/README.md`
- `.specify/specs/vaop-mvp-domain-atlas-research-programme.md`
