# Bead-0096: Payroll Port Adapter Foundation

## Scope

- `src/application/ports/payroll-adapter.ts`
- `src/application/ports/index.ts`
- `src/infrastructure/adapters/payroll/in-memory-payroll-adapter.ts`
- `src/infrastructure/adapters/payroll/in-memory-payroll-adapter.test.ts`
- `src/infrastructure/index.ts`
- `.specify/specs/port-v1.md`

## Implementation Summary

- Added a typed application boundary for Payroll operations with the
  12-operation union from the port taxonomy.
- Implemented an in-memory Payroll adapter foundation covering:
  - payroll run create/get/list;
  - pay stub get/list;
  - tax calculation and pay schedule lookup;
  - deductions and earnings list reads;
  - payroll approval submission and decision flows;
  - contractor payment listing.
- Added application and infrastructure barrel exports.

## Verification

- `npm run test -- src/infrastructure/adapters/payroll/in-memory-payroll-adapter.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch.
