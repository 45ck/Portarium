# Bead-0159: Dependency Resolver

## Scope

- `scripts/beads/check-bead-prerequisites.mjs`
- `docs/governance/bead-prerequisite-resolver.md`

## Implementation Summary

- Added a prerequisite resolver CLI that evaluates bead readiness against
  unresolved `blockedBy` dependencies from `.beads/issues.jsonl`.
- Added both single-bead and `--next` modes:
  - single-bead mode returns detailed missing-prerequisite diagnostics and
    exits non-zero when the bead is not startable;
  - `--next` mode lists all open beads currently ready to start.
- Added governance documentation covering usage, outputs, and exit codes.

## Verification

- `node scripts/beads/check-bead-prerequisites.mjs bead-0159 --json`
- `node scripts/beads/check-bead-prerequisites.mjs bead-0529 --json` (expected non-zero; blocked)
- `node scripts/beads/check-bead-prerequisites.mjs --next --json`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch before later stages execute.
