# Bead-0088: ProcurementSpend Port Adapter Foundation

## Scope

- `src/application/ports/procurement-spend-adapter.ts`
- `src/application/ports/index.ts`
- `src/infrastructure/adapters/procurement-spend/in-memory-procurement-spend-adapter.ts`
- `src/infrastructure/adapters/procurement-spend/in-memory-procurement-spend-adapter.test.ts`
- `src/infrastructure/index.ts`
- `.specify/specs/port-v1.md`

## Implementation Summary

- Added a typed application boundary for ProcurementSpend operations with the
  14-operation union from the port taxonomy.
- Implemented an in-memory ProcurementSpend adapter foundation covering:
  - purchase order create/get/approve/list;
  - expense report create/get/approve/list (external refs);
  - vendor create/get/list;
  - RFQ create;
  - contract list/get.
- Added application and infrastructure barrel exports.

## Verification

- `npm run test -- src/infrastructure/adapters/procurement-spend/in-memory-procurement-spend-adapter.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch.
