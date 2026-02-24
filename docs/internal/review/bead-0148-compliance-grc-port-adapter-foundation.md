# Bead-0148: ComplianceGrc Port Adapter Foundation

## Scope

- `src/application/ports/compliance-grc-adapter.ts`
- `src/application/ports/index.ts`
- `src/infrastructure/adapters/compliance-grc/in-memory-compliance-grc-adapter.ts`
- `src/infrastructure/adapters/compliance-grc/in-memory-compliance-grc-adapter.test.ts`
- `src/infrastructure/index.ts`
- `.specify/specs/port-v1.md`

## Implementation Summary

- Added a typed application boundary for ComplianceGrc operations with the
  22-operation union from the port taxonomy.
- Implemented an in-memory ComplianceGrc adapter foundation covering:
  - controls, risks, policies, and audits (`list/get/create` plus status/assessment/publish);
  - findings lifecycle (`listFindings`, `createFinding`) modeled as canonical tickets;
  - evidence and framework flows (`listEvidenceRequests`, `uploadEvidence`,
    `list/getFramework`, `mapControlToFramework`).
- Added application and infrastructure barrel exports.
- Added deterministic unit coverage for tenant isolation, happy paths, validation
  failures, not-found behavior, and unsupported operations.

## Verification

- `npm run test -- src/infrastructure/adapters/compliance-grc/in-memory-compliance-grc-adapter.test.ts`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate baseline mismatch.
