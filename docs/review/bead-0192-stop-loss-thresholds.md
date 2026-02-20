# Bead-0192: Stop-Loss Thresholds

## Scope

- `docs/governance/stop-loss-thresholds.md`
- `scripts/beads/evaluate-stop-loss-thresholds.mjs`
- `src/infrastructure/beads/evaluate-stop-loss-thresholds.test.ts`
- `docs/governance/stop-loss-thresholds-status.md`
- `docs/governance/execution-order-runbook.md`
- `docs/governance-work-backlog.md`
- `docs/index.md`
- `package.json`

## Implementation Summary

- Defined explicit stop-loss halt thresholds for:
  - risk score;
  - failed critical gates;
  - unresolved open decisions.
- Added deterministic enforcement tooling:
  - status generation command;
  - `--enforce` mode that exits non-zero when halt is required.
- Added test coverage for halt/non-halt scenarios and status artifact check mode.
- Linked stop-loss policy into governance runbooks and docs navigation.

## Verification

- `npm run test -- src/infrastructure/beads/evaluate-stop-loss-thresholds.test.ts src/infrastructure/beads/generate-bead-acceptance-scorecard.test.ts src/infrastructure/beads/generate-bead-metadata-audit.test.ts src/infrastructure/beads/generate-weekly-pe-audit.test.ts`
- `npm run beads:stop-loss:status`
- `npm run beads:stop-loss:status:check`
- `npm run beads:stop-loss:enforce -- --failed-gates ci:pr` (expected non-zero when halt condition is met)
- `npx prettier --check docs/governance/stop-loss-thresholds.md docs/governance/stop-loss-thresholds-status.md scripts/beads/evaluate-stop-loss-thresholds.mjs src/infrastructure/beads/evaluate-stop-loss-thresholds.test.ts docs/governance/execution-order-runbook.md docs/governance-work-backlog.md docs/index.md docs/review/bead-0192-stop-loss-thresholds.md`
- `npx cspell --no-progress --config cspell.json docs/governance/stop-loss-thresholds.md docs/governance/stop-loss-thresholds-status.md scripts/beads/evaluate-stop-loss-thresholds.mjs src/infrastructure/beads/evaluate-stop-loss-thresholds.test.ts docs/governance/execution-order-runbook.md docs/governance-work-backlog.md docs/index.md docs/review/bead-0192-stop-loss-thresholds.md`
- `npm run ci:pr` (still blocked by existing repository-wide lint baseline outside bead scope)

## Notes

- Stop-loss evaluation is intentionally conservative to force explicit risk discussion
  before cycle continuation when governance signals degrade.
