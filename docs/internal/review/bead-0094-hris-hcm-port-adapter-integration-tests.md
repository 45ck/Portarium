# Bead-0094: HrisHcm Port Adapter Integration Tests

## Scope

- `src/infrastructure/adapters/hris-hcm/in-memory-hris-hcm-adapter.integration.test.ts`

## Test Coverage Added

- Employee flow: create/get/update/terminate/list.
- Department and job-position flow: list and lookup.
- Time-off flow: request/get plus company-structure read.
- Benefit enrolment flow: list benefit subscriptions.

## Verification

- `npm run test -- src/infrastructure/adapters/hris-hcm/in-memory-hris-hcm-adapter.integration.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch before later stages execute.
