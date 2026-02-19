# Bead-0161: Foundation Phase Gate Enforcement

## Scope

- `scripts/beads/check-bead-prerequisites.mjs`
- `.beads/phase-gate-map.json`
- `docs/governance/bead-prerequisite-resolver.md`
- `docs/governance/phase-gate-enforcement.md`

## Implementation Summary

- Added declarative phase-gate requirements in `.beads/phase-gate-map.json` for
  `bead-0161` through `bead-0168`.
- Extended prerequisite resolver with `--phase-gate` mode to enforce that each
  required bead in a phase-gate requirement set is closed.
- Added structured phase-gate reporting in both JSON and human output,
  including requirement-group status and unresolved gate dependencies.
- Documented phase-gate usage and map contract under governance docs.

## Verification

- `node scripts/beads/check-bead-prerequisites.mjs bead-0161 --phase-gate --json`
- `node scripts/beads/check-bead-prerequisites.mjs bead-0162 --phase-gate --json` (expected non-zero; gate unmet)
- `node scripts/beads/check-bead-prerequisites.mjs --next --phase-gate --json`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate-baseline mismatch before
  later stages execute.
