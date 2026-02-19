# Bead-0118: SecretsVaulting Port Adapter Integration Tests

## Scope

- `src/infrastructure/adapters/secrets-vaulting/in-memory-secrets-vaulting-adapter.integration.test.ts`

## Test Coverage Added

- Secret lifecycle flow: put, get, rotate, list with prefix filtering, and delete.
- Certificate and key flow: create/renew/list certificates and create/list keys.
- Crypto and governance flow: encrypt/decrypt, set secret policy, and audit log retrieval.
- Tenant-isolation flow: tenant-scoped listings and cross-tenant certificate lookup rejection.
- Validation flow: missing required fields for `getSecret`, `encrypt`, and `setSecretPolicy`.

## Verification

- `npm run test -- src/infrastructure/adapters/secrets-vaulting/in-memory-secrets-vaulting-adapter.integration.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch before later stages execute.
