# Bead-0112: IamDirectory Port Adapter Foundation

## Scope

- `src/application/ports/iam-directory-adapter.ts`
- `src/application/ports/index.ts`
- `src/infrastructure/adapters/iam-directory/in-memory-iam-directory-adapter.ts`
- `src/infrastructure/adapters/iam-directory/in-memory-iam-directory-adapter.test.ts`
- `src/infrastructure/index.ts`
- `.specify/specs/port-v1.md`

## Implementation Summary

- Added a typed application boundary for IamDirectory operations with the
  18-operation union from the port taxonomy.
- Implemented an in-memory IamDirectory adapter foundation covering:
  - user list/get/create/update/deactivate flows;
  - group and role list/get/create/assignment flows;
  - application list/get, authentication, MFA verification, and audit-log reads.
- Added application and infrastructure barrel exports.

## Verification

- `npm run test -- src/infrastructure/adapters/iam-directory/in-memory-iam-directory-adapter.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch.
