# Bead 0193 Review - Canonical E2E Seed Bundle

## Scope

- Added canonical seed factories for cross-suite E2E data model baselines:
  - `src/domain/testing/canonical-seeds-v1.ts`
- Added validation tests for parseability, linkage integrity, and override behavior:
  - `src/domain/testing/canonical-seeds-v1.test.ts`

## Acceptance coverage

- Workspace seed: deterministic workspace/tenant/users/project/credential references.
- Policy seed: deterministic policy id/version/rules + SoD constraints.
- Run seed: deterministic workflow/run/correlation/tier/status tuple.
- Evidence seed: deterministic evidence links to run/plan/work-item with payload refs.
- Work-item seed: deterministic linkage to run/workflow/approval/evidence ids.
- Bundle factory: produces all five seed primitives together for shared integration tests.

## Verification

```bash
npm run typecheck
npm run test -- src/domain/testing/canonical-seeds-v1.test.ts
```

## Notes

- Seeds are immutable-by-convention baselines with per-entity override support for scenario-specific tests.
- Evidence entries are validated through the domain hash-chain append path in test coverage.
