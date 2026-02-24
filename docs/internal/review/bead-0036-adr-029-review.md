# bead-0036 ADR-0029 review: chain continuity under retention/disposition

## Scope reviewed

- Evidence hash-chain append/verification behavior.
- Retention and payload disposition interactions with chain metadata continuity.

## Findings

1. Continuity behavior is correct when payloads are deleted after retention and a disposition metadata event is appended.
2. Chain-break detection correctly fails when disposition metadata is linked to an incorrect `previousHash`.

## Changes made

- Added `src/infrastructure/evidence/evidence-retention-chain-continuity.test.ts` with:
  - retention-active deletion block -> expiry -> payload deletion -> disposition metadata append -> chain verifies.
  - forced incorrect `previousHash` on disposition metadata -> verification fails with `previous_hash_mismatch`.

## Verification status

- New retention/disposition continuity tests pass.
- Full `ci:pr` currently blocked by pre-existing gate baseline mismatch:
  - `package.json` hash mismatch
  - missing `knip.json` in baseline
