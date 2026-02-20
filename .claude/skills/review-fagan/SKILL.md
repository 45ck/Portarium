---
name: review-fagan
description: Run a formal inspection-style review (Fagan) using a checklist, producing a merge-blocking review record.
disable-model-invocation: true
argument-hint: "[prTitle]"
allowed-tools: Read, Grep, Glob
---

# Formal Review Gate (Fagan-style)

## Outputs
- `reports/review/INSPECTION_RECORD.md`

## Entry criteria (must ALL be true before review starts)
- All Tier B CI checks pass (`npm run ci:pr` green).
- Spec updated or explicitly linked (`.specify/specs/` artefact).
- Tests exist for changed domain logic.
- Contracts documented for changed public APIs.

## Review checklist
### Design correctness
- [ ] Architecture boundaries respected (domain independent of infra)
- [ ] Invariants stated and enforced
- [ ] Error handling explicit (no swallowed errors)
- [ ] No new circular dependencies

### Code correctness
- [ ] No unsafe promise usage (no-floating-promises)
- [ ] Complexity caps respected
- [ ] No `any` or `ts-ignore` without documented justification
- [ ] Domain primitives used (no raw strings for IDs)

### Test adequacy
- [ ] Boundary tests added for new contracts
- [ ] Mutation score acceptable for changed areas
- [ ] Regression tests for bugfixes

### Documentation
- [ ] ADR added/updated if design changed
- [ ] Glossary updated if new domain terms introduced
- [ ] API docs updated if public surface changed

## Exit criteria (must ALL be true before merge)
- All defects resolved or documented with explicit rationale.
- QA evidence attached if user flows changed.
- Beads issue updated/closed.
