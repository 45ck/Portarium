# Bead-0098: Payroll Port Adapter Integration Tests

## Scope

- `src/infrastructure/adapters/payroll/in-memory-payroll-adapter.integration.test.ts`

## Test Coverage Added

- Payroll run flow: run/get/list plus submit-for-approval and approve operations.
- Pay artifact flow: list/get pay stubs, pay schedule lookup, and tax calculation.
- Payroll metadata flow: deductions and earnings list reads.
- Contractor payment flow: list with and without status filter.

## Verification

- `npm run test -- src/infrastructure/adapters/payroll/in-memory-payroll-adapter.integration.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch before later stages execute.
