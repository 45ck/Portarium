# Deployment Truth v1

## Purpose

Model ADR-0037 explicitly: Git-backed definitions and runtime truth divergence handling.

## Schema (DefinitionTruthStateV1)

Fields:

- `schemaVersion`: `1`
- `workspaceId`: branded `WorkspaceId`
- `deploymentMode`: `Local | Team`
- `definitionsTruthMode`: `GitAuthoritative | RuntimeAuthoritative`
- `runtimeStateStore`: `Database`
- `gitRef?`: git commit/tag/reference for definition source
- `appliedGitRef?`: last git reference reconciled into runtime
- `runtimeHasUnappliedMutations`: boolean
- `divergenceStatus`: `InSync | GitAhead | RuntimeAhead | Conflict`
- `lastReconciledAtIso?`: ISO timestamp
- `transitionLog`: ordered list of truth-mode transitions

### Transition log entry

- `transitionedAtIso`: ISO timestamp
- `transitionedByUserId`: branded `UserId`
- `fromMode`: prior truth mode
- `toMode`: target truth mode
- `reason`: non-empty string

## Rules

- `gitRef` is required when `definitionsTruthMode` is `GitAuthoritative`.
- `transitionLog` entries must be timestamp-ordered.
- Truth-mode transitions are explicit, append-only, and auditable.
- Divergence is computed from git/runtime drift:
  - `InSync`: no git drift and no runtime drift
  - `GitAhead`: git drift only
  - `RuntimeAhead`: runtime drift only
  - `Conflict`: both drifts present
