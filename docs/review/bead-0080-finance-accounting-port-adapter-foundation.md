# Bead-0080: FinanceAccounting Port Adapter Foundation

## Scope

- `src/application/ports/finance-accounting-adapter.ts`
- `src/application/ports/index.ts`
- `src/infrastructure/adapters/finance-accounting/in-memory-finance-accounting-adapter.ts`
- `src/infrastructure/adapters/finance-accounting/in-memory-finance-accounting-adapter.test.ts`
- `src/infrastructure/index.ts`
- `.specify/specs/port-v1.md`

## Implementation Summary

- Added a typed application boundary for FinanceAccounting operations with a fixed
  16-operation union aligned to the Port taxonomy.
- Added vendor result variants to the port contract using canonical `PartyV1`.
- Implemented an in-memory FinanceAccounting adapter foundation with:
  - tenant-scoped account/invoice/bill/vendor reads;
  - in-memory create invoice/bill write stubs;
  - accepted/opaque stubs for journal/report/reconciliation operations;
  - explicit validation and not-found errors.
- Added infrastructure and application barrel exports.

## Verification

- `npm run test -- src/infrastructure/adapters/finance-accounting/in-memory-finance-accounting-adapter.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` still includes pre-existing baseline hash mismatches unrelated to this bead.
