# bead-0195 tenant-isolated fixture factories

## Scope

- Provide tenant-isolated fixture factories for aggregate-level test data.
- Provide tenant-isolated fixture factories for all in-memory port adapter families.
- Prove cross-tenant leakage is blocked in fixture generation tests.

## Changes

- Added aggregate fixture factory:
  - `src/domain/testing/tenant-isolated-aggregate-fixtures-v1.ts`
  - Generates linked `workspace`, `policy`, `run`, `workItem`, `evidence`, `approval`
    fixtures scoped by tenant suffix.
- Added aggregate fixture tests:
  - `src/domain/testing/tenant-isolated-aggregate-fixtures-v1.test.ts`
  - Verifies parseability + reference consistency.
  - Verifies tenant-to-tenant ID isolation.
- Added port fixture factory registry:
  - `src/infrastructure/testing/tenant-isolated-port-fixtures-v1.ts`
  - Covers all 18 adapter families via `seedMinimal(...)`.
- Added port fixture tests:
  - `src/infrastructure/testing/tenant-isolated-port-fixtures-v1.test.ts`
  - Verifies coverage across all families.
  - Verifies tenant IDs are scoped to requested tenant.
  - Verifies no cross-tenant leakage between two bundles.

## Verification

- `npm run test -- src/domain/testing/tenant-isolated-aggregate-fixtures-v1.test.ts src/infrastructure/testing/tenant-isolated-port-fixtures-v1.test.ts`
- `npx eslint src/domain/testing/tenant-isolated-aggregate-fixtures-v1.ts src/domain/testing/tenant-isolated-aggregate-fixtures-v1.test.ts src/infrastructure/testing/tenant-isolated-port-fixtures-v1.ts src/infrastructure/testing/tenant-isolated-port-fixtures-v1.test.ts`
- `npm run typecheck`
