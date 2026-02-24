# Review: bead-0178 (Architecture Boundary Validation)

Reviewed on: 2026-02-20

Scope:

- Architecture boundary enforcement before merge
- New scaffold files added in this execution slice

## Acceptance Evidence

Objective:

- Ensure architecture boundaries are validated before code merge for newly introduced scaffold work.

Enforcement added:

- `package.json`:
  - `architecture-guard` script (alias for `depcruise`)
  - `ci:merge-guard` script (`ci:gates + architecture-guard + audit:high`)
- CI workflow:
  - `.github/workflows/merge-guard.yml` on `pull_request` and `merge_group`

Verification commands:

```bash
npm run architecture-guard
npm run ci:merge-guard
```

Results:

- `architecture-guard` correctly fails on an existing application-layer cycle:
  - `src/application/commands/assign-workforce-member.helpers.ts`
  - `src/application/commands/assign-workforce-member.ts`
- `ci:merge-guard` also fails on the same architecture violation and therefore blocks merge, which is expected behavior.

Conclusion:

- Architecture-boundary validation is now explicitly required in CI before merge.
- Existing violations are surfaced as blocking signals rather than silently passing.

## Findings

High:

- Existing circular dependency in application command helpers remains unresolved and blocks architecture guard.

Medium:

- none.

Low:

- none.
