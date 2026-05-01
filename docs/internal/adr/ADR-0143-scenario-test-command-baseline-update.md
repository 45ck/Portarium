# ADR-0143: Scenario Test Command Baseline Update

**Beads:** bead-1142
**Status:** Accepted
**Date:** 2026-05-01

## Context

`npm run test:scenarios` previously invoked Vitest with the literal path
`scripts/integration/scenario-*.test.ts`. On Windows, that pattern is not
expanded by the shell before Vitest receives it, so the public scenario test
command could report that no test files were found even though the scenario
suite existed and `ci:scenario-gate` could run it.

ADR-0041 treats package-level gate and script changes as quality-critical. This
decision records the intentional `package.json` baseline update for bead-1142.

## Decision

Point `npm run test:scenarios` at the `scripts/integration/scenario` directory
instead of a shell-expanded glob.

`ci:scenario-gate` remains the stricter CI wrapper that runs the scenario suite,
writes the scenario reports, and checks the governed experiment invariants.

## Consequences

- Contributors can run `npm run test:scenarios` consistently on Windows and
  Unix-like shells.
- `ci:scenario-gate` remains the release-quality scenario gate.
- `.ci/gate-baseline.json` is regenerated to acknowledge the intentional
  `package.json` hash change.

## Implementation Mapping

- `package.json` updates `test:scenarios` to invoke Vitest on
  `scripts/integration/scenario`.
- `.ci/gate-baseline.json` records the updated `package.json` hash.
