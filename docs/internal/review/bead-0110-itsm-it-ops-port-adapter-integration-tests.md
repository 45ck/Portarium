# Bead-0110: ItsmItOps Port Adapter Integration Tests

## Scope

- `src/infrastructure/adapters/itsm-it-ops/in-memory-itsm-it-ops-adapter.integration.test.ts`

## Test Coverage Added

- Incident flow: create/update/get/resolve/list.
- Change request flow: create/list/approve.
- Asset and CMDB flow: create/update/get/list assets and list/get CMDB items.
- Problem and service request flow: create/list problems and list service requests.
- Validation flow: missing incident identifier checks.

## Verification

- `npm run test -- src/infrastructure/adapters/itsm-it-ops/in-memory-itsm-it-ops-adapter.integration.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch before later stages execute.
