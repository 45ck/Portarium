---
name: review-fagan
description: Produce a checklist-driven inspection record (Fagan-style) as merge evidence.
disable-model-invocation: true
argument-hint: '[prTitle]'
allowed-tools: Read, Grep, Glob
---

# Formal Review (Fagan-Style)

## Entry Criteria

- `npm run ci:pr` is green.
- Spec is updated or linked under `.specify/specs/`.
- ADR added/updated under `docs/adr/` if architecture or cross-cutting behaviour changed.

## Output

- Create or update `reports/review/INSPECTION_RECORD.md`:
  - Roles (moderator/reader/recorder)
  - Defect log (category, location, resolution)
  - Exit criteria
