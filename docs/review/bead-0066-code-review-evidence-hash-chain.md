# Code Review: bead-0066 (ADR-029 Evidence Hash Chain + Signature Hooks)

Reviewed on: 2026-02-18

Scope:

- Evidence entry hash chaining and verification: `src/domain/evidence/evidence-chain-v1.ts`
- Signature hook interfaces: `src/domain/evidence/evidence-hasher.ts`
- EvidenceEntry/Artifact signature fields: `src/domain/evidence/evidence-entry-v1.ts`, `src/domain/runs/artifact-v1.ts`
- Unit tests for tamper detection and signature behaviour

## Findings

### High

- None found.

### Medium

- Timestamp monotonicity is verified using lexicographic comparison of `occurredAtIso` strings.
  - File: `src/domain/evidence/evidence-chain-v1.ts`
  - Impact: Correct for strict ISO 8601 UTC timestamps (e.g. `2026-02-18T12:34:56.789Z`), but can be wrong if offsets or non-normalized formats are ever allowed.
  - Recommendation: Either document that `occurredAtIso` must be normalized UTC with `Z` (enforced at parse time), or parse to epoch milliseconds before comparing.

### Low

- `verifyEvidenceChainV1` skips signature verification when no verifier is provided, even if entries contain `signatureBase64`.
  - File: `src/domain/evidence/evidence-chain-v1.ts`
  - Impact: This is a reasonable default for environments where signing is not yet deployed, but it should be called out as a deployment requirement: signature validation must be enabled in production where signatures are emitted.
  - Recommendation: Document the expected production wiring (where the verifier comes from) in the infrastructure/security ADRs, and add an application-layer guard that refuses to accept signed entries without verification when running in “strict” mode.

## Notes

- The chain verification covers:
  - `previousHash` linkage validation for every entry,
  - hash recalculation against canonical JSON to detect tampering,
  - optional signature verification over canonical JSON excluding `signatureBase64`,
  - monotonic timestamp checks to detect reordering.
- Unit tests include tamper scenarios and signature invariants (signature does not change `hashSha256`), which is the right minimum bar for ADR-029.
