# ADR-0116: Control-Plane Scenario Suite as CI Quality Gate

- **Status**: Accepted
- **Date**: 2026-03-02
- **Bead**: bead-0851

## Context

The control-plane scenario test suite (`scripts/integration/scenario-*.test.ts`)
covers cross-cutting invariants — evidence hash-chain integrity, auth/authz
negative-path contracts, and bypass-policy enforcement — that unit tests alone
cannot validate. These scenarios already run inside `test:coverage` via the
vitest include glob (`scripts/**/*.test.ts`), but there is no dedicated gate
that:

1. Fails the build when a specific scenario category regresses.
2. Produces downloadable artifacts (JSON summary, JUnit XML) for post-mortem.
3. Enforces deterministic ordering for reproducibility.

## Decision

Add a **scenario gate** (`npm run ci:scenario-gate`) that:

- Runs only `scripts/integration/scenario-*.test.ts` via vitest with a fixed
  `--sequence.seed` for deterministic ordering.
- Validates three invariant categories by pattern-matching test names:
  - `evidence-sequence` — hash-chain and evidence-log assertions
  - `auth-contract` — 401/403 negative-path enforcement
  - `bypass-policy` — egress governance and fail-closed assertions
- Writes `reports/scenarios/scenario-summary.json` and
  `test-results/scenario-junit.xml` for CI artifact upload.
- Is wired into `ci:pr` **after** `test:unit` and **before**
  `cockpit:build-storybook`.

### Runtime budget

| Suite           | Test count | Wall-clock (local, 2026-03-02) | Target  |
| --------------- | ---------- | ------------------------------ | ------- |
| Scenario (PR)   | ~65        | ~8 s                           | < 30 s  |
| Full unit suite | ~5 600     | ~45 s                          | < 120 s |

The scenario gate adds negligible overhead because:

- Scenario tests are pure in-process (stub HTTP servers on `127.0.0.1:0`).
- No containers, no database, no network I/O beyond loopback.
- The same tests already execute inside `test:coverage`; the gate re-runs them
  with invariant validation, adding ~2 s of overhead for result parsing.

### PR vs nightly split strategy

| Gate               | When               | What                                    |
| ------------------ | ------------------ | --------------------------------------- |
| `ci:scenario-gate` | Every PR (`ci:pr`) | Scenario tests + invariant validation   |
| `test:scenarios`   | Ad-hoc / local     | Bare vitest run without gate validation |
| `ci:nightly`       | Nightly            | Full suite including mutation testing   |

The PR gate intentionally re-runs scenario tests (they already ran in
`test:unit`) because the gate validates **invariant categories**, not just
pass/fail. A scenario test that passes but was renamed to no longer match an
invariant pattern would be caught by the gate but not by `test:unit`.

## Consequences

- CI wall-clock increases by ~10 s per PR (scenario re-run + validation).
- Regressions in evidence, auth, or bypass categories are caught before merge.
- Scenario summary artifacts are available for download on every PR run.
- New scenario files matching `scripts/integration/scenario-*.test.ts` are
  automatically included; no manifest to maintain.
