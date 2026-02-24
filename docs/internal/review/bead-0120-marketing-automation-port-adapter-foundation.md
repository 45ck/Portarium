# Bead-0120: MarketingAutomation Port Adapter Foundation

## Scope

- `src/application/ports/marketing-automation-adapter.ts`
- `src/application/ports/index.ts`
- `src/infrastructure/adapters/marketing-automation/in-memory-marketing-automation-adapter.ts`
- `src/infrastructure/adapters/marketing-automation/in-memory-marketing-automation-adapter.test.ts`
- `src/infrastructure/index.ts`
- `.specify/specs/port-v1.md`

## Implementation Summary

- Added a typed application boundary for MarketingAutomation operations with the
  18-operation union from the port taxonomy.
- Implemented an in-memory MarketingAutomation adapter foundation covering:
  - contact lifecycle (list/get/create/update);
  - list membership operations (list/get/add/remove);
  - campaign lifecycle and stats (list/get/create/send/stats);
  - automation and forms operations (list/get/trigger/list forms/submissions).
- Added application and infrastructure barrel exports.

## Verification

- `npm run test -- src/infrastructure/adapters/marketing-automation/in-memory-marketing-automation-adapter.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch.
