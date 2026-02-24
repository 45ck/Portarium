# Bead-0100: CrmSales Port Adapter Foundation

## Scope

- `src/application/ports/crm-sales-adapter.ts`
- `src/application/ports/index.ts`
- `src/infrastructure/adapters/crm-sales/in-memory-crm-sales-adapter.ts`
- `src/infrastructure/adapters/crm-sales/in-memory-crm-sales-adapter.test.ts`
- `src/infrastructure/index.ts`
- `.specify/specs/port-v1.md`

## Implementation Summary

- Added a typed application boundary for CrmSales operations with the
  16-operation union from the port taxonomy.
- Implemented an in-memory CrmSales adapter foundation covering:
  - contact and company list/get/create/update flows;
  - opportunity list/get/create and stage transitions;
  - pipeline list reads via `ExternalObjectRef`;
  - activity list/create task operations;
  - note list/create document operations.
- Added application and infrastructure barrel exports.

## Verification

- `npm run test -- src/infrastructure/adapters/crm-sales/in-memory-crm-sales-adapter.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch.
