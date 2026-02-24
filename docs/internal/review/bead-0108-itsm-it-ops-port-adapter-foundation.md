# Bead-0108: ItsmItOps Port Adapter Foundation

## Scope

- `src/application/ports/itsm-it-ops-adapter.ts`
- `src/application/ports/index.ts`
- `src/infrastructure/adapters/itsm-it-ops/in-memory-itsm-it-ops-adapter.ts`
- `src/infrastructure/adapters/itsm-it-ops/in-memory-itsm-it-ops-adapter.test.ts`
- `src/infrastructure/index.ts`
- `.specify/specs/port-v1.md`

## Implementation Summary

- Added a typed application boundary for ItsmItOps operations with the
  17-operation union from the port taxonomy.
- Implemented an in-memory ItsmItOps adapter foundation covering:
  - incident list/get/create/update/resolve flows;
  - change request list/create/approve flows;
  - asset and CMDB list/get/create/update flows;
  - problem list/create and service request list flows.
- Added application and infrastructure barrel exports.

## Verification

- `npm run test -- src/infrastructure/adapters/itsm-it-ops/in-memory-itsm-it-ops-adapter.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch.
