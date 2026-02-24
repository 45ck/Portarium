# Bead-0160: Cycle Gate Linkage Enforcement

## Scope

- `scripts/beads/check-bead-prerequisites.mjs`
- `.beads/bead-linkage-map.json`
- `docs/internal/governance/bead-prerequisite-resolver.md`
- `docs/internal/governance/cycle-gate-linkage.md`

## Implementation Summary

- Extended the prerequisite resolver with `--cycle-gate` mode to block
  implementation beads that lack design/spec and review linkage.
- Added linkage sources:
  - explicit registry entries in `.beads/bead-linkage-map.json`;
  - `.specify/specs/*` references from bead body text;
  - `Spec:` / `ADR:` dependencies from `blockedBy`;
  - inferred review beads that mention the target bead id in review-title issues.
- Added linkage registry and governance docs to standardize how teams attach
  spec/review context before starting implementation beads.

## Verification

- `node scripts/beads/check-bead-prerequisites.mjs bead-0298 --cycle-gate --json` (expected ready)
- `node scripts/beads/check-bead-prerequisites.mjs bead-0539 --cycle-gate --json` (expected non-zero; missing linkage)
- `node scripts/beads/check-bead-prerequisites.mjs --next --cycle-gate --json`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch before later stages execute.
