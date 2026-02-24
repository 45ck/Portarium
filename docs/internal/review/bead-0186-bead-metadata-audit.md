# Bead-0186: Bead Metadata Audit Enforcement

## Scope

- `scripts/beads/generate-bead-metadata-audit.mjs`
- `src/infrastructure/beads/generate-bead-metadata-audit.test.ts`
- `docs/internal/governance/bead-metadata-audit.md`
- `package.json`

## Implementation Summary

- Added an automated metadata audit for all beads that verifies required fields:
  - owner (`owner` field, fallback to active `claimedBy`);
  - close criteria (`closeCriteria` field or `AC:`/acceptance criteria in body);
  - rollback trigger (`rollbackTrigger` field or rollback wording in body).
- Added reporting and enforcement modes:
  - `npm run beads:audit:metadata` writes `docs/internal/governance/bead-metadata-audit.md`;
  - `npm run beads:audit:metadata:check` validates artifact freshness;
  - `npm run beads:audit:metadata:enforce` exits non-zero when non-compliant beads exist.
- Added integration-style tests that execute the script in temp repos and verify
  detection logic, check mode, and enforce mode.

## Verification

- `npm run beads:audit:metadata`
- `npm run beads:audit:metadata:check`
- `npm run test -- src/infrastructure/beads/generate-bead-metadata-audit.test.ts`
- `npx eslint scripts/beads/generate-bead-metadata-audit.mjs src/infrastructure/beads/generate-bead-metadata-audit.test.ts`
- `npm run ci:pr` (still blocked by existing repo-wide lint baseline outside this bead)

## Notes

- Current audit snapshot reports broad metadata gaps, which is expected and now
  visible/enforceable through the added report and enforce command.
