# Bead-0114: IamDirectory Port Adapter Integration Tests

## Scope

- `src/infrastructure/adapters/iam-directory/in-memory-iam-directory-adapter.integration.test.ts`

## Test Coverage Added

- User flow: create, update, deactivate, and list users.
- Group flow: create group, assign/remove membership, and list groups.
- Role and auth flow: assign/revoke role, list/get applications, authenticate user, verify MFA.
- Audit flow: list audit logs.
- Validation flow: missing required payload fields for MFA and role assignment.

## Verification

- `npm run test -- src/infrastructure/adapters/iam-directory/in-memory-iam-directory-adapter.integration.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch before later stages execute.
