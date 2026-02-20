# Bead-0191: Bead Acceptance Scorecard

## Scope

- `scripts/beads/generate-bead-acceptance-scorecard.mjs`
- `src/infrastructure/beads/generate-bead-acceptance-scorecard.test.ts`
- `docs/governance/bead-acceptance-scorecard.md`
- `docs/governance/execution-order-runbook.md`
- `docs/governance-work-backlog.md`
- `docs/index.md`
- `package.json`

## Implementation Summary

- Added an automated acceptance scorecard audit that scores every open bead against:
  - spec alignment;
  - tests;
  - review;
  - docs;
  - security;
  - performance.
- Added CI-friendly generation/check scripts:
  - `npm run beads:audit:scorecard`
  - `npm run beads:audit:scorecard:check`
- Added unit tests for JSON scoring behavior and check-mode artifact validation.
- Linked the generated scorecard into governance runbooks and backlog artifact tracking.

## Verification

- `npm run test -- src/infrastructure/beads/generate-bead-acceptance-scorecard.test.ts src/infrastructure/beads/generate-bead-metadata-audit.test.ts src/infrastructure/beads/generate-weekly-pe-audit.test.ts`
- `npm run beads:audit:scorecard`
- `npm run beads:audit:scorecard:check`
- `npx prettier --check scripts/beads/generate-bead-acceptance-scorecard.mjs src/infrastructure/beads/generate-bead-acceptance-scorecard.test.ts docs/governance/execution-order-runbook.md docs/governance-work-backlog.md docs/index.md docs/review/bead-0191-bead-acceptance-scorecard.md`
- `npx cspell --no-progress --config cspell.json scripts/beads/generate-bead-acceptance-scorecard.mjs src/infrastructure/beads/generate-bead-acceptance-scorecard.test.ts docs/governance/bead-acceptance-scorecard.md docs/governance/execution-order-runbook.md docs/governance-work-backlog.md docs/index.md docs/review/bead-0191-bead-acceptance-scorecard.md`
- `npm run ci:pr` (still blocked by existing repository-level typecheck/lint baseline outside bead scope)

## Notes

- The scorecard intentionally uses deterministic heuristics so it can be regenerated and reviewed in every cycle.
