# Review: bead-0184 (Transition Gate Linkage Enforcement)

Reviewed on: 2026-02-20

Scope:

- `scripts/beads/check-bead-prerequisites.mjs`
- `docs/internal/governance/bead-prerequisite-resolver.md`

## Acceptance Evidence

Objective:

- Require open implementation beads to carry both:
  - at least one test-evidence bead linkage, and
  - at least one code-review bead linkage,
    before they are considered transition-ready.

Implemented:

- Added `--transition-gate` mode to prerequisite resolver.
- Added linkage sources for transition checks:
  - explicit `.beads/bead-linkage-map.json` `testBeads` and `reviewBeads`
  - inferred testing/code-review beads referencing target bead ids
- Extended implementation-bead detection to include implementation phases
  (`domain`, `application`, `infrastructure`, `presentation`, `integration`),
  while excluding spec/review beads.
- Updated governance doc for resolver usage and transition-gate semantics.

Verification commands:

```bash
node scripts/beads/check-bead-prerequisites.mjs bead-0340 --cycle-gate --transition-gate --json
node scripts/beads/check-bead-prerequisites.mjs --next --cycle-gate --transition-gate --json
```

Observed results:

- `bead-0340` is now flagged as not transition-ready with missing:
  - spec linkage
  - test evidence linkage
  - code-review linkage
- `--next` now excludes implementation beads that fail cycle/transition gate checks.

Conclusion:

- Transition readiness is no longer inferred loosely for implementation beads; it is now explicitly gated by test + code-review linkage evidence.

## Findings

High:

- Multiple open implementation beads currently fail transition linkage requirements and should not transition until linkage is added.

Medium:

- none.

Low:

- none.
