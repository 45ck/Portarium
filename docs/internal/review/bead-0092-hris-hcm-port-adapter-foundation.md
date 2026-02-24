# Bead-0092: HrisHcm Port Adapter Foundation

## Scope

- `src/application/ports/hris-hcm-adapter.ts`
- `src/application/ports/index.ts`
- `src/infrastructure/adapters/hris-hcm/in-memory-hris-hcm-adapter.ts`
- `src/infrastructure/adapters/hris-hcm/in-memory-hris-hcm-adapter.test.ts`
- `src/infrastructure/index.ts`
- `.specify/specs/port-v1.md`

## Implementation Summary

- Added a typed application boundary for HrisHcm operations with the
  12-operation union from the port taxonomy.
- Implemented an in-memory HrisHcm adapter foundation covering:
  - employee list/get/create/update/terminate;
  - department list/get;
  - job position list;
  - time-off get/request;
  - benefit enrolment list;
  - company structure retrieval.
- Added application and infrastructure barrel exports.

## Verification

- `npm run test -- src/infrastructure/adapters/hris-hcm/in-memory-hris-hcm-adapter.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch.
