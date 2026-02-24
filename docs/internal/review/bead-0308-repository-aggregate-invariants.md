# Bead-0308: Repository-Level Aggregate Invariants

## Scope

- `src/application/ports/workspace-store.ts`
- `src/application/ports/workflow-store.ts`
- `src/application/ports/adapter-registration-store.ts`
- `src/application/services/repository-aggregate-invariants.ts`
- `src/application/commands/register-workspace.ts`
- `src/application/commands/start-workflow.ts`
- `src/application/commands/register-workspace.test.ts`
- `src/application/commands/start-workflow.test.ts`
- `src/application/services/repository-aggregate-invariants.test.ts`
- `.specify/specs/application-layer-v1.md`

## Implementation Summary

- Added repository-facing invariant checks at application command boundaries:
  - workspace-name uniqueness per tenant on `RegisterWorkspace`;
  - active workflow version policy (single active head) on `StartWorkflow`;
  - single active adapter per required workflow action port family;
  - generated run-id uniqueness before run persistence.
- Added new application port contracts required for these checks:
  - `WorkspaceStore.getWorkspaceByName(...)`;
  - `WorkflowStore.listWorkflowsByName(...)`;
  - `AdapterRegistrationStore.listByWorkspace(...)`.
- Added dedicated invariant service and test coverage for each invariant family.
- Updated application-layer spec to codify new command-level invariant rules.

## Verification

- `npm run test -- src/application/commands/register-workspace.test.ts src/application/commands/start-workflow.test.ts src/application/services/repository-aggregate-invariants.test.ts src/presentation/runtime/control-plane-handler.test.ts src/application/queries/get-workspace.test.ts`
- `npm run typecheck`
- `npm run ci:pr`

## Notes

- `ci:pr` remains blocked by the pre-existing gate-baseline mismatch before
  later stages execute.
