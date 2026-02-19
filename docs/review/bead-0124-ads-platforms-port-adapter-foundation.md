# Bead-0124: AdsPlatforms Port Adapter Foundation

## Scope

- `src/application/ports/ads-platforms-adapter.ts`
- `src/application/ports/index.ts`
- `src/infrastructure/adapters/ads-platforms/in-memory-ads-platforms-adapter.ts`
- `src/infrastructure/adapters/ads-platforms/in-memory-ads-platforms-adapter.test.ts`
- `src/infrastructure/index.ts`
- `.specify/specs/port-v1.md`

## Implementation Summary

- Added a typed application boundary for AdsPlatforms operations with the
  19-operation union from the port taxonomy.
- Implemented an in-memory AdsPlatforms adapter foundation covering:
  - campaign lifecycle (list/get/create/update/pause);
  - ad-group and ad lifecycle operations;
  - performance stats lookups for campaign, ad group, and ad;
  - audience, budget, and keyword operations.
- Added application and infrastructure barrel exports.

## Verification

- `npm run test -- src/infrastructure/adapters/ads-platforms/in-memory-ads-platforms-adapter.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch.
