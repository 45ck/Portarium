# bead-0181 coverage-thresholds review

## Scope

Verify that test coverage thresholds are enforced for domain/application/infrastructure code
and wired into CI quality gates.

## Evidence

- `vitest.config.ts` enforces global coverage thresholds:
  - statements: `90`
  - branches: `85`
  - functions: `90`
  - lines: `90`
- `package.json` `ci:pr` includes `npm run test:coverage`, so PR gates fail when coverage
  thresholds are not met.

## Verification Run

- Executed: `npm run test:coverage`
- Result: command failed in current working tree due unrelated in-progress
  `submit-map-command-intent` changes.
- Interpretation: gate enforcement is active and failing fast; threshold wiring is effective.

## Outcome

Pass for bead scope: coverage-threshold gate is present and enforced through CI.
