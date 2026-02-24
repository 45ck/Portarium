# Bead-0188: Execution Order Runbook

## Scope

- `docs/internal/governance/execution-order-runbook.md`
- `docs/internal/governance-work-backlog.md`
- `docs/index.md`

## Implementation Summary

- Added a start-to-finish execution runbook with explicit owner assignments for:
  - Domain Atlas;
  - control-plane API;
  - evidence pipeline;
  - adapter family waves.
- Defined staged execution order, hard handoff criteria, and cross-stream checks.
- Linked the runbook from governance backlog and docs entrypoint for discovery.

## Verification

- `npx prettier --check docs/internal/governance/execution-order-runbook.md docs/internal/governance-work-backlog.md docs/index.md docs/internal/review/bead-0188-execution-order-runbook.md`
- `npx cspell --no-progress --config cspell.json docs/internal/governance/execution-order-runbook.md docs/internal/governance-work-backlog.md docs/index.md docs/internal/review/bead-0188-execution-order-runbook.md`
- `npm run ci:pr` (still blocked by existing repo-wide lint baseline outside this bead)

## Notes

- The runbook assigns ownership by role so teams can map named individuals per cycle without editing process logic.
