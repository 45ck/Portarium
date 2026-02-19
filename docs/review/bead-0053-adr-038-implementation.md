# Bead-0053 ADR-038 Implementation Review

## Scope

Implemented Work Item universal binding enhancements and added query surfaces for run/workflow/approval/evidence linkages.

## Implemented

- Extended Work Item link model:
  - `src/domain/work-items/work-item-v1.ts`
  - Added `links.workflowIds?: WorkflowId[]`
- Added Work Item query storage contract:
  - `src/application/ports/work-item-store.ts`
  - Exported via `src/application/ports/index.ts`
- Added query use-cases:
  - `src/application/queries/get-work-item.ts`
  - `src/application/queries/list-work-items.ts`
  - Exported via `src/application/queries/index.ts`
- Added RBAC action for Work Item reads:
  - `APP_ACTIONS.workItemRead` in `src/application/common/actions.ts`
  - Role matrix updated in `src/application/iam/rbac/workspace-rbac.ts`
- Updated cockpit client list filters to expose linkage query params:
  - `src/presentation/ops-cockpit/types.ts`
  - `src/presentation/ops-cockpit/http-client.ts`
- Updated OpenAPI Work Item contract:
  - `docs/spec/openapi/portarium-control-plane.v1.yaml`
  - Added `workflowIds` in `WorkItemLinksV1`
  - Added list query params: `runId`, `workflowId`, `approvalId`, `evidenceId`
- Updated specs:
  - `.specify/specs/work-item-v1.md`
  - `.specify/specs/control-plane-api-v1.md`

## Tests added/updated

- `src/domain/work-items/work-item-v1.test.ts`
- `src/application/queries/get-work-item.test.ts`
- `src/application/queries/list-work-items.test.ts`
- `src/application/iam/rbac/workspace-rbac.test.ts`
- `src/presentation/ops-cockpit/http-client.test.ts`

## Verification

- `npm run test -- src/application/queries/list-work-items.test.ts src/application/queries/get-work-item.test.ts src/domain/work-items/work-item-v1.test.ts src/application/iam/rbac/workspace-rbac.test.ts src/presentation/ops-cockpit/http-client.test.ts` passes.
- `npm run typecheck` passes.
- `npm run ci:pr` still fails at existing gate baseline mismatch (`package.json`, missing `knip.json`, `.github/workflows/ci.yml` hash mismatch).
