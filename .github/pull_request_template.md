## Intent

- What problem does this solve?
- Link to spec/task: <!-- Spec Kit doc + bd issue id -->

## Spec & decisions

- [ ] Spec updated (`.specify/specs/...`) OR existing spec linked
- [ ] ADR added/updated (if architecture or cross-cutting changes)

## Contracts & API discipline

- [ ] Public API changes include contract docs
- [ ] Boundary tests added (invalid input, invariants, error paths)

## Test evidence

- [ ] Unit tests added/updated
- [ ] Coverage thresholds met (see CI)
- [ ] Mutation score policy met or explicitly waived (brownfield only)

## Architecture evidence

- [ ] dependency-cruiser passes (no cycles, boundaries respected)
- [ ] knip passes (no unused exports/deps)

## Gate integrity

- [ ] If gate/config files changed: ADR added/updated and `.ci/gate-baseline.json` updated

## QA evidence (if user flows / UI changed)

- [ ] agent-browser QA run completed
- [ ] Traces saved under `qa-artifacts/<date>/traces/`
- [ ] Screenshots saved under `qa-artifacts/<date>/screenshots/`
- [ ] `reports/qa/QA_REPORT.md` updated

## Beads

- [ ] Issue linked: bd#<!-- issue id -->
- [ ] `.beads/issues.jsonl` committed
