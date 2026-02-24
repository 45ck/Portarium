# Review: bead-0481 (Tenancy Identity Unification)

Reviewed on: 2026-02-20

Scope:

- bead-0304 TenantId/WorkspaceId alias policy
- compile-time guard behavior against identity drift
- domain docs alignment and usage consistency

## Acceptance Criteria Check

1. Alias policy matches ADR/intended model:

- Verified in domain primitives: `WorkspaceId` is an explicit alias of `TenantId` in v1, and factory aliasing is unified (`WorkspaceId = TenantId`).
- Evidence:
  - `src/domain/primitives/index.ts`
  - `src/application/iam/workspace-actor.ts`

2. Compile-time guard blocks drift and is tested with deliberate violation:

- Verified by type-level guard (`WorkspaceIdEqualsTenantId`) and value guard (`WORKSPACE_ID_ALIAS_GUARD`) plus deliberate compile-time violation assertion using `@ts-expect-error`.
- Evidence:
  - `src/domain/primitives/index.ts`
  - `src/domain/primitives/index.test.ts`

3. docs/domain updated:

- Added explicit note describing WorkspaceId/TenantId alias policy and guard.
- Evidence:
  - `docs/domain/README.md`

4. No remaining WorkspaceId/TenantId inconsistency:

- Verified by code scan and spot checks across domain/application ports and parsers. Conversions like `WorkspaceId(input.tenantId)` are consistent with alias policy, not divergence.
- Evidence:
  - `src/application/ports/*.ts`
  - `src/domain/**/*`
  - `src/infrastructure/temporal/activities.ts`

## Verification Run

Executed:

```bash
npm run test -- src/domain/primitives/index.test.ts src/application/iam/workspace-actor.test.ts
```

Result:

- 2 test files passed
- 12 tests passed

## Findings

High: none.

Medium: none.

Low: none.
