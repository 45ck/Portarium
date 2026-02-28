# ADR-0116: Package.json Gate Baseline Drift Resolution

## Status

Accepted

## Context

The gate integrity baseline (`.ci/gate-baseline.json`, see ADR-0041) tracks SHA-256
hashes of critical configuration files, including `package.json`. Between commits
`a0b9db1` and `ea1f07d`, multiple additive changes landed in `package.json` that
triggered a baseline hash mismatch in `npm run ci:gates`:

1. **Discoverability metadata** -- updated `description` field and added a `keywords`
   array to improve npm registry and GitHub search visibility.
2. **New npm scripts** -- added scripts for the OpenClaw approval demo
   (`cockpit:dev:openclaw-demo`, `cockpit:demo:openclaw:clips`,
   `cockpit:demo:openclaw:iphone`), QA metrics tracking (`qa:durations`,
   `qa:pass-rate`), docs validation (`docs:layout:check`,
   `docs:discoverability:check`), and repository organization
   (`repo:cleanup:local`, `repo:check:organization`).
3. **Docs path corrections** -- updated `docs:spell` and `docs:lint` globs to
   reflect the `docs/_meta` to `docs/internal/_meta` directory restructure.
4. **Domain atlas audit** -- added `domain-atlas:upstreams:audit` script and
   corrected the `domain-atlas:ci` diff path from `docs/research/index.md` to
   `docs/internal/research/index.md`.

These changes are purely additive or correctional. No enforcement thresholds,
lint rules, test coverage gates, or architecture boundary configurations were
weakened or altered. The baseline was regenerated in commit `ea1f07d` alongside
the `package.json` changes, restoring `ci:gates` to a passing state.

## Decision

Accept the updated gate baseline hash for `package.json` as legitimate. The
changes fall into the "no enforcement weakening" category described in ADR-0041
and require only this documentation record rather than a gate-policy review.

Going forward, any `package.json` change that modifies or removes existing CI
scripts, alters `workspaces` configuration, or changes dependency resolution
behavior must receive a separate ADR with explicit gate-impact analysis.

## Consequences

- The gate baseline is now current with the checked-in `package.json`.
- `npm run ci:gates` passes on a clean checkout of `main`.
- This ADR provides the audit trail required by ADR-0041 for baseline updates.
- No enforcement semantics were weakened; no rollback or additional gate
  hardening is needed.
