# Code Review: bead-0064 (IAM MVP)

Reviewed on: 2026-02-18

Scope:

- Workspace-scoped actor claims parsing (`sub`, `workspaceId`, `roles`)
- RBAC action matrix enforcement (`AppAction` -> required `WorkspaceUserRole[]`)
- `AppContext` role typing + deny-by-default behavior

## Findings

### High

- None found.

### Medium

- `toAppContext` silently drops unknown roles rather than rejecting.
  - File: `src/application/common/context.ts`
  - Impact: If a caller constructs `AppContext` directly (not via JWT claims parsing), a mistyped role could lead to an empty effective role set and unexpected `Forbidden` outcomes. This is safe (deny-by-default) but can be confusing operationally.
  - Recommendation: Consider a strict variant (e.g. `toAppContextStrict`) that rejects unknown roles for boundary usage, and keep the current normalizing behavior for tests/fixtures.

### Low

- RBAC matrix is currently embedded in code and may drift from `.specify/specs/iam-mvp.md` / OpenAPI route mapping as more actions/routes are added.
  - File: `src/application/iam/rbac/workspace-rbac.ts`
  - Recommendation: Add a small table-driven test asserting the action matrix exactly matches the spec, or generate the matrix from a single source of truth.

## Notes

- Claim parsing is strict and correctly rejects missing identifiers, unknown roles, and duplicate roles.
  - File: `src/application/iam/workspace-actor.ts`
- Default authorization behavior is deny-by-default when roles are missing/unknown, consistent with bead acceptance criteria.
  - Files: `src/application/common/context.ts`, `src/application/iam/rbac/workspace-rbac.ts`
