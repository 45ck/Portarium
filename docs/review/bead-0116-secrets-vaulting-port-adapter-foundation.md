# Bead-0116: SecretsVaulting Port Adapter Foundation

## Scope

- `src/application/ports/secrets-vaulting-adapter.ts`
- `src/application/ports/index.ts`
- `src/infrastructure/adapters/secrets-vaulting/in-memory-secrets-vaulting-adapter.ts`
- `src/infrastructure/adapters/secrets-vaulting/in-memory-secrets-vaulting-adapter.test.ts`
- `src/infrastructure/index.ts`
- `.specify/specs/port-v1.md`

## Implementation Summary

- Added a typed application boundary for SecretsVaulting operations with the
  15-operation union from the port taxonomy.
- Implemented an in-memory SecretsVaulting adapter foundation covering:
  - secret lifecycle (get/put/list/rotate/delete);
  - certificate lifecycle (create/get/renew/list);
  - crypto and key operations (encrypt/decrypt/create/list keys);
  - audit-log reads and secret-policy updates.
- Added application and infrastructure barrel exports.

## Verification

- `npm run test -- src/infrastructure/adapters/secrets-vaulting/in-memory-secrets-vaulting-adapter.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch.
