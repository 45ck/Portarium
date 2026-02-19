# Bead-0060 Review: Operation Contract Stub Verification

## Scope

- Verify operation stub fixtures for:
  - completeness
  - canonical mapping consistency
  - source-ranking assumptions

## Implementation

- Added verifier:
  - `scripts/domain-atlas/verify-operation-contract-stubs.mjs`
- Added npm command:
  - `domain-atlas:ops-stubs:verify`
- Wired into:
  - `domain-atlas:ci`
- Report output:
  - `reports/domain-atlas/operation-contract-stub-verification.json`

## Documentation Updates

- `docs/research/README.md`
- `.specify/specs/vaop-mvp-domain-atlas-research-programme.md`
