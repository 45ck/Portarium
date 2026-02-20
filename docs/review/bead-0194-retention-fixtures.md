# bead-0194 synthetic evidence and retention fixtures

## Scope

- Define reusable synthetic fixtures for:
  - proof-of-retention workflows
  - legal-hold apply/release workflows
- Exercise those fixtures in integration-style tests against WORM retention behavior.

## Changes

- Added fixture factory module:
  - `src/domain/testing/synthetic-evidence-retention-fixtures-v1.ts`
  - Provides:
    - `createProofOfRetentionFixtureV1()`
    - `createLegalHoldWorkflowFixtureV1()`
- Added integration tests:
  - `src/infrastructure/evidence/synthetic-evidence-retention-fixtures.integration.test.ts`
  - Verifies:
    - deletion blocked while retention is active
    - deletion blocked while legal hold is active, even after retention date
    - deletion succeeds after legal hold release
    - evidence chain remains valid after disposition metadata append

## Acceptance mapping

1. Synthetic evidence + retention fixtures exist for proof-of-retention.
2. Legal-hold workflow is exercised using fixtures.
3. Chain integrity remains valid through disposition events.

## Verification

- `npm run test -- src/infrastructure/evidence/synthetic-evidence-retention-fixtures.integration.test.ts`
- `npm run ci:pr`
