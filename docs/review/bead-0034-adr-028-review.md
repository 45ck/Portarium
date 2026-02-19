# bead-0034 ADR-0028 review: privacy minimization and retention/disposition precedence

## Scope reviewed

- Domain evidence append and verification flow.
- Evidence payload WORM controls and deletion behavior.
- Evidence spec alignment for immutable metadata constraints.

## Findings

1. Gap found (fixed): immutable evidence append path had no domain guard for obvious PII leakage in metadata.
2. Gap found (fixed): no explicit test for precedence after legal hold release (legal hold first, then retention window).

## Changes made

- Added domain guard: `assertEvidencePrivacyMinimizationV1` in `src/domain/evidence/evidence-privacy-v1.ts`.
- Wired guard into append transition: `appendEvidenceEntryV1` in `src/domain/evidence/evidence-chain-v1.ts`.
- Added tests:
  - `src/domain/evidence/evidence-privacy-v1.test.ts`
  - `src/domain/evidence/evidence-chain-v1.test.ts` (append rejection case)
  - `src/infrastructure/evidence/in-memory-worm-evidence-payload-store.test.ts` (legal-hold release precedence path)
- Updated spec: `.specify/specs/evidence-v1.md` with explicit minimization invariants.

## Verification status

- Targeted tests for evidence privacy/chain/WORM precedence pass.
- Full `ci:pr` currently blocked by pre-existing gate baseline mismatch:
  - `package.json` hash mismatch
  - missing `knip.json` in baseline
