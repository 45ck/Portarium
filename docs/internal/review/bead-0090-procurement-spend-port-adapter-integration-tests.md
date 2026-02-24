# Bead-0090: ProcurementSpend Port Adapter Integration Tests

## Scope

- `src/infrastructure/adapters/procurement-spend/in-memory-procurement-spend-adapter.integration.test.ts`

## Test Coverage Added

- Purchase order flow: create/get/approve/list.
- Expense report flow: create/get/approve/list.
- Vendor and RFQ flow: create/get/list vendors and create RFQ.
- Contract flow: list/get.

## Verification

- `npm run test -- src/infrastructure/adapters/procurement-spend/in-memory-procurement-spend-adapter.integration.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch before later stages.
