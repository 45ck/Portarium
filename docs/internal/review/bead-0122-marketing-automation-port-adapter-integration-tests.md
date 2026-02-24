# Bead-0122: MarketingAutomation Port Adapter Integration Tests

## Scope

- `src/infrastructure/adapters/marketing-automation/in-memory-marketing-automation-adapter.integration.test.ts`

## Test Coverage Added

- Contact flow: create, update, get, list, and list-membership add/remove operations.
- Campaign flow: create, send, get, list, and campaign stats retrieval.
- Automation and forms flow: list/get/trigger automation and form submissions retrieval.
- Validation flow: missing required payload fields for send campaign, trigger automation, and form submissions.

## Verification

- `npm run test -- src/infrastructure/adapters/marketing-automation/in-memory-marketing-automation-adapter.integration.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch before later stages execute.
