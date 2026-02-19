# Bead-0126: AdsPlatforms Port Adapter Integration Tests

## Scope

- `src/infrastructure/adapters/ads-platforms/in-memory-ads-platforms-adapter.integration.test.ts`

## Test Coverage Added

- Campaign flow: create, update, pause, and stats retrieval.
- Ad-group and ad flow: create/list/get with performance stats retrieval.
- Audience/budget/keyword flow: audience create/list, budget get/update, keyword listing.
- Validation flow: missing required payload fields for campaign, ad-group stats, and budget updates.

## Verification

- `npm run test -- src/infrastructure/adapters/ads-platforms/in-memory-ads-platforms-adapter.integration.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch before later stages execute.
