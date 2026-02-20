# Bead-0189: Failing Cycle Rollback Runbook

## Scope

- `docs/governance/failing-cycle-rollback-runbook.md`
- `docs/governance/execution-order-runbook.md`
- `docs/governance-work-backlog.md`
- `docs/index.md`

## Implementation Summary

- Added a rollback runbook that defines:
  - rollback triggers;
  - freeze scope controls;
  - rollback scope levels (L1/L2/L3);
  - technical rollback sequence for app/infra/data/evidence/credentials;
  - verification and controlled unfreeze criteria;
  - communication templates for declaration, progress, and recovery.
- Linked rollback guidance from execution runbook and docs entrypoint.

## Verification

- `npx prettier --check docs/governance/failing-cycle-rollback-runbook.md docs/governance/execution-order-runbook.md docs/governance-work-backlog.md docs/index.md docs/review/bead-0189-rollback-runbook.md`
- `npx cspell --no-progress --config cspell.json docs/governance/failing-cycle-rollback-runbook.md docs/governance/execution-order-runbook.md docs/governance-work-backlog.md docs/index.md docs/review/bead-0189-rollback-runbook.md`
- `npm run ci:pr` (still blocked by existing repo-wide lint baseline outside this bead)

## Notes

- This runbook is structured to support the follow-on review bead that validates
  data, evidence, and credential cleanup actions are explicitly covered.
