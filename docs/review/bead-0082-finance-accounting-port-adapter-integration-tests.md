# Bead-0082: FinanceAccounting Port Adapter Integration Tests

## Scope

- `src/infrastructure/adapters/finance-accounting/in-memory-finance-accounting-adapter.integration.test.ts`

## Test Coverage Added

- Create/List/Get invoice flow for tenant-scoped adapter data.
- Create/List/Get bill flow for tenant-scoped adapter data.
- Vendor list/get path returning canonical `PartyV1` vendor records.
- Opaque response paths for journal/report/reconciliation stub operations.

## Verification

- `npm run test -- src/infrastructure/adapters/finance-accounting/in-memory-finance-accounting-adapter.integration.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` still fails at the pre-existing gate baseline mismatch before reaching later stages.
