# Review: bead-0483 (OpenAPI Contract Alignment)

Reviewed on: 2026-02-20

Scope:

- bead-0447 contract reconciliation follow-up
- AdapterRegistration capability matrix requirements
- WorkItem, CredentialGrant, and Policy schema parity against domain parsers

## Acceptance Criteria Check

1. OpenAPI spec passes contract validation checks:
- Verified with OpenAPI contract test parsing + schema validation pass.
- Evidence:
  - `src/infrastructure/openapi/openapi-contract.test.ts`
  - `docs/spec/openapi/portarium-control-plane.v1.yaml`

2. `capabilityMatrix` is required in AdapterRegistration and non-empty:
- Verified and tightened in OpenAPI (`required` + `minItems: 1`), aligned with parser enforcement.
- Evidence:
  - `docs/spec/openapi/portarium-control-plane.v1.yaml`
  - `src/domain/adapters/adapter-registration-v1.ts`
  - `src/domain/adapters/adapter-registration-v1.test.ts`

3. WorkItem, CredentialGrant, Policy schemas match domain parsers:
- Fixed and verified parity drifts:
  - `WorkItemStatus` enum now includes `Open|InProgress|Blocked|Resolved|Closed`.
  - `CapabilityClaimV1.capability` pattern aligned to domain capability shape (`noun:verb`).
  - Added `PolicyId` and full `PolicyV1`/SoD/rules schemas for domain parity checks.
- Added parser + schema parity assertions in OpenAPI contract test.
- Evidence:
  - `docs/spec/openapi/portarium-control-plane.v1.yaml`
  - `src/domain/work-items/work-item-v1.ts`
  - `src/domain/credentials/credential-grant-v1.ts`
  - `src/domain/policy/policy-v1.ts`
  - `src/infrastructure/openapi/openapi-contract.test.ts`

4. No regressions in existing contract tests:
- Verified by targeted suite execution.
- Evidence:
  - `src/infrastructure/openapi/openapi-contract.test.ts`
  - `src/domain/adapters/adapter-registration-v1.test.ts`
  - `src/domain/work-items/work-item-v1.test.ts`
  - `src/domain/credentials/credential-grant-v1.test.ts`
  - `src/domain/policy/policy-v1.test.ts`

## Verification Run

Executed:

```bash
npm run test -- src/infrastructure/openapi/openapi-contract.test.ts src/domain/adapters/adapter-registration-v1.test.ts src/domain/work-items/work-item-v1.test.ts src/domain/credentials/credential-grant-v1.test.ts src/domain/policy/policy-v1.test.ts
```

Result:

- 5 test files passed
- 53 tests passed

## Findings

High: none.

Medium: none.

Low:

- `npm run ci:pr` currently fails due a large pre-existing repo-wide lint backlog unrelated to this bead's changes (multiple files outside this scope).
