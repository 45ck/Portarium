# Review: bead-0585 (Beads Claim/Unclaim Workflow)

Reviewed on: 2026-02-20

Scope:

- `bd` CLI claim/unclaim workflow
- claim-aware list/next filtering and output visibility
- contributor documentation updates for claim discipline

## Acceptance Criteria Check

1. Commands documented and implemented:

- Verified `issue claim` and `issue unclaim` command handling, help text, claim metadata fields, and close-path claim clearing.
- Evidence:
  - `scripts/beads/bd.mjs`

2. Claim metadata and visibility:

- Verified `claimedBy`/`claimedAt` fields in view/JSON output and claim suffix in non-JSON list rendering.
- Verified claim-aware filters for `list` and `next` (`--claimed`, `--unclaimed`, `--claimed-by`).
- Evidence:
  - `scripts/beads/bd.mjs`
  - `src/infrastructure/beads/bd-cli.test.ts`

3. Integration-style behavior tests:

- Verified lock behavior tests for claim, conflict, forced reassignment, unclaim mismatch/force, and close-clears-claim.
- Evidence:
  - `src/infrastructure/beads/bd-cli.test.ts`

4. Contributor docs updated to require claim/unclaim flow:

- Verified guidance updates in agent/project/contributor docs and development workflow docs.
- Evidence:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `CONTRIBUTING.md`
  - `README.md`
  - `docs/getting-started/dev-workflow.md`
  - `docs/development-start-here.md`

## Verification Run

Executed:

```bash
npx eslint scripts/beads/bd.mjs src/infrastructure/beads/bd-cli.test.ts
npm run test -- src/infrastructure/beads/bd-cli.test.ts
```

Result:

- Lint passed for touched CLI/test files
- 1 test file passed
- 4 tests passed

## Findings

High: none.

Medium: none.

Low: none.
