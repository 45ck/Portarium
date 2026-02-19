# Bead-0150: ComplianceGrc Port Adapter Integration Tests

## Scope

- `src/infrastructure/adapters/compliance-grc/in-memory-compliance-grc-adapter.integration.test.ts`

## Test Coverage Added

- Core operational flow: controls, risks, policies, and audits including
  list/get/create/update/assess/publish behaviors.
- Evidence flow: findings lifecycle, evidence request listing, evidence upload,
  and control-to-framework mapping.
- Error flow: validation and not-found branches for malformed payloads and
  unknown records.

## Verification

- `npm run test -- src/infrastructure/adapters/compliance-grc/in-memory-compliance-grc-adapter.integration.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch before later stages execute.
