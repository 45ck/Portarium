# Bead-0045 ADR-034 Implementation Review

## Scope

Implemented containment and least-privilege enforcement at machine/adapter execution registration boundaries.

## Changes

- Added required adapter `executionPolicy` contract in `src/domain/adapters/adapter-registration-v1.ts`:
  - `tenantIsolationMode` must be `PerTenantWorker`
  - `egressAllowlist` must be non-empty HTTPS URLs
  - `credentialScope` must be `capabilityMatrix`
  - `sandboxVerified` must be `true`
  - `sandboxAvailable` is recorded as declared capability metadata
- Added required machine `executionPolicy` contract in `src/domain/machines/machine-registration-v1.ts`:
  - `isolationMode` must be `PerTenantWorker`
  - `egressAllowlist` must be non-empty HTTPS URLs
  - `workloadIdentity` must be `Required`
- Enforced active machine auth posture:
  - active machines must provide `authConfig` and cannot use `kind: none`
- Updated contract tests:
  - `src/domain/adapters/adapter-registration-v1.test.ts`
  - `src/domain/machines/machine-registration-v1.test.ts`
  - `src/domain/services/provider-selection.test.ts` (updated typed fixture shape)
- Updated contract specs:
  - `.specify/specs/adapter-registration-v1.md`
  - `.specify/specs/machine-interface-v1.md`
- Updated OpenAPI contract:
  - `docs/spec/openapi/portarium-control-plane.v1.yaml`
    - new `AdapterExecutionPolicyV1` schema
    - `executionPolicy` required on adapter registration create/read

## Verification

- `npm run test -- src/domain/adapters/adapter-registration-v1.test.ts src/domain/machines/machine-registration-v1.test.ts src/domain/services/provider-selection.test.ts` passes (56 tests).
- `npm run typecheck` passes.
- `npm run ci:pr` still fails at existing baseline gate mismatch (`package.json` hash mismatch and missing `knip.json`), unchanged by this bead.
