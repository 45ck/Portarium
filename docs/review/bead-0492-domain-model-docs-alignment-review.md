# Review: bead-0492 (Domain Model Docs Alignment)

Reviewed on: 2026-02-20

Scope:

- `docs/domain/canonical-objects.md`
- `docs/domain/erd.md`
- `docs/domain/aggregates.md`
- `docs/domain-layer-work-backlog.md`

## Acceptance Criteria Check

1. `docs/domain/canonical-objects.md` matches implemented runtime model:

- Updated wording to match actual runtime contract shape (`externalRefs?` optional).
- Added explicit note that canonical table fields are conceptual and runtime source-of-truth is `src/domain/canonical/*-v1.ts`.
- Evidence:
  - `docs/domain/canonical-objects.md`
  - `src/domain/canonical/index.ts`

2. `docs/domain/erd.md` reflects actual aggregate boundaries and references:

- Replaced stale conceptual ERD with as-implemented snapshot aligned to current `*-v1` parser contracts.
- Included implemented relationships among Workspace, Workflow, Run, Policy, AdapterRegistration, CredentialGrant, WorkItem, Project, Approval, Artifact.
- Evidence:
  - `docs/domain/erd.md`
  - `src/domain/workspaces/workspace-v1.ts`
  - `src/domain/workflows/workflow-v1.ts`
  - `src/domain/runs/run-v1.ts`
  - `src/domain/policy/policy-v1.ts`
  - `src/domain/adapters/adapter-registration-v1.ts`
  - `src/domain/work-items/work-item-v1.ts`
  - `src/domain/credentials/credential-grant-v1.ts`

3. `docs/domain/aggregates.md` invariants traced to implementation:

- Rewrote aggregates documentation as an as-implemented invariant map tied to parser and service contracts.
- Added explicit Run transition state machine section aligned to compile-time/runtime guards.
- Evidence:
  - `docs/domain/aggregates.md`
  - `src/domain/services/run-status-transitions.ts`

4. `domain-layer-work-backlog.md` DONE/closed statuses updated:

- Updated closed statuses for completed P0/P1 domain beads in the pre-existing cross-reference table:
  - `bead-0302`, `0303`, `0304`, `0305`, `0306`, `0307`, `0309`, `0337`, `0338`.
- Evidence:
  - `docs/domain-layer-work-backlog.md`
  - `.beads/issues.jsonl`

## Verification Run

Executed:

```bash
npm run bd -- issue view bead-0302
npm run bd -- issue view bead-0303
npm run bd -- issue view bead-0304
npm run bd -- issue view bead-0305
npm run bd -- issue view bead-0306
npm run bd -- issue view bead-0307
npm run bd -- issue view bead-0309
npm run bd -- issue view bead-0337
npm run bd -- issue view bead-0338
```

Result:

- All listed beads are `closed` in tracker.

## Findings

High: none.

Medium: none.

Low: none.
