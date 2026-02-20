# Review: bead-0487 (IAM MVP + JWT Validation + AuthZ Wiring)

Reviewed on: 2026-02-20

Scope:

- bead-0016 (IAM MVP role model and RBAC baseline)
- bead-0417 (JWT validation + principal extraction)
- bead-0418 (AuthorizationPort wired to OpenFGA/role-aware checks)

## Acceptance Criteria Check

1. All 4 roles (`admin`, `operator`, `approver`, `auditor`) enforced at routes:
- Verified in role matrix and route-path tests.
- Evidence:
  - `src/application/iam/rbac/workspace-rbac.ts`
  - `src/application/iam/rbac/workspace-rbac.test.ts`
  - `src/presentation/runtime/control-plane-handler.test.ts`

2. OWASP BOLA scenarios pass:
- Tenant scoping and forbidden mapping covered by handler and query/command tests.
- Evidence:
  - `src/presentation/runtime/control-plane-handler.test.ts`
  - `src/application/queries/get-approval.test.ts`
  - `src/application/commands/assign-workforce-member.test.ts`

3. Deny-by-default with unknown role:
- Unknown roles are rejected at actor parsing and dropped in context normalization for safety.
- Evidence:
  - `src/application/iam/workspace-actor.test.ts`
  - `src/application/common/context.ts`

4. Token refresh/rotation path documented:
- Token semantics and operational guidance documented in backlog/spec references.
- Evidence:
  - `docs/application-layer-work-backlog.md`
  - `.specify/specs/iam-mvp.md`
  - `docs/reference/runtime-and-env.md`

## Verification Run

Executed:

```bash
npm run test -- src/infrastructure/auth/jose-jwt-authentication.test.ts src/infrastructure/auth/openfga-authorization.test.ts src/application/iam/rbac/workspace-rbac.test.ts src/presentation/runtime/control-plane-handler.test.ts
```

Result:

- 4 test files passed
- 34 tests passed

## Findings

High: none.

Medium:

- No single consolidated "token refresh/rotation runbook" document exists yet; references are distributed across backlog/spec/reference docs. This satisfies minimum documentation acceptance but is operationally fragmented.

Low:

- `toAppContext` intentionally drops unknown roles for deny-by-default safety. This is correct from a security perspective, but a strict boundary-only parser mode may improve diagnostics for misconfigured identity providers.
