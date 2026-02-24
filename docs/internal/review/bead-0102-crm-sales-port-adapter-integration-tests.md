# Bead-0102: CrmSales Port Adapter Integration Tests

## Scope

- `src/infrastructure/adapters/crm-sales/in-memory-crm-sales-adapter.integration.test.ts`

## Test Coverage Added

- Contact flow: create/get/update/list.
- Company and opportunity flow: create company, create/update/list opportunities, list pipelines.
- Activity and note flow: create/list activities and create/list notes.
- Validation flow: missing identifier checks for required CRM operations.

## Verification

- `npm run test -- src/infrastructure/adapters/crm-sales/in-memory-crm-sales-adapter.integration.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch before later stages execute.
