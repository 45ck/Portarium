# bead-0588 cockpit route-load smoke tests review

## Scope

- Route-level page-load smoke tests for Cockpit primary and detail routes.
- QA checklist presence for manual UI/UX load verification.

## Evidence reviewed

- Automated smoke tests:
  - `apps/cockpit/src/routes/page-load.test.tsx`
- QA checklist:
  - `docs/internal/qa/cockpit-route-load-checklist.md`

## Verification

- `npm run -w apps/cockpit test -- src/routes/page-load.test.tsx`
  - Result: pass (`1` file, `25` tests).
- `npm run -w apps/cockpit test`
  - Result: pass (`3` files, `37` tests).

## Findings

- High: none.
- Medium: none.
- Low: none.

## Result

- `bead-0588` acceptance is satisfied: route smoke coverage exists and passes, and a QA checklist is available.
