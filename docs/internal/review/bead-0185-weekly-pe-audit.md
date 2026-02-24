# Bead-0185: Weekly PE Audit For Orphaned Beads And Dependency Deadlocks

## Scope

- `scripts/beads/generate-weekly-pe-audit.mjs`
- `src/infrastructure/beads/generate-weekly-pe-audit.test.ts`
- `docs/internal/governance/weekly-pe-audit.md`
- `package.json`

## Implementation Summary

- Added a deterministic PE audit generator that reads `.beads/issues.jsonl` and
  produces a weekly governance report at `docs/internal/governance/weekly-pe-audit.md`.
- The generated report includes:
  - open-bead snapshot metrics;
  - orphaned bead table (open beads with no open blockers and no open dependents);
  - dependency deadlock cycles (strongly-connected components / self-loops).
- Added CLI modes for automation:
  - `--check` for stale-file validation in CI/local gates;
  - `--stdout` for pipeline usage;
  - `--json` for machine-readable consumption.
- Added npm scripts:
  - `npm run beads:audit:weekly`
  - `npm run beads:audit:weekly:check`
- Added integration-style tests that execute the script in temp repos and verify
  orphan/deadlock detection and `--check` behavior.

## Verification

- `npm run beads:audit:weekly`
- `npm run beads:audit:weekly:check`
- `npm run test -- src/infrastructure/beads/generate-weekly-pe-audit.test.ts`
- `npx eslint scripts/beads/generate-weekly-pe-audit.mjs src/infrastructure/beads/generate-weekly-pe-audit.test.ts src/infrastructure/beads/bd-cli.test.ts`
- `npm run ci:pr` (still blocked by existing repo-wide lint baseline outside this bead)

## Notes

- Current snapshot reports no deadlock cycles and flags orphaned open beads per
  the explicit rule definition in the generated document.
