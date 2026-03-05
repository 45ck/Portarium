# ADR-0120: Security Dependency Baseline Update for package.json

## Status

Accepted

## Context

The gate integrity baseline (`.ci/gate-baseline.json`, see ADR-0041) tracks
SHA-256 hashes of critical configuration files, including `package.json`.

As part of bead-0886, `package.json` changed for two production dependency
reasons:

1. **Removed root `@storybook/test` dependency** -- the package is only used by
   Cockpit story files and is already declared as a workspace dev dependency in
   `apps/cockpit/package.json`. Keeping it at the repo root pulled Storybook's
   webpack toolchain into the production audit graph and surfaced
   `serialize-javascript` via `terser-webpack-plugin`.
2. **Raised `hono` patch floor** -- the root runtime dependency moved from
   `^4.12.1` to `^4.12.5` so clean tracked installs avoid the audited high
   severity Hono advisories fixed after `4.12.3`.

These changes alter dependency selection but do not weaken any enforcement gate.
Lint rules, coverage thresholds, architecture boundaries, and CI gate ordering
remain unchanged.

## Decision

Accept the updated gate baseline hash for `package.json` as legitimate. The
change is a security hardening update to the tracked dependency graph and falls
within the ADR-0041 category of baseline updates that require documentation but
not a separate gate-policy change.

## Consequences

- The gate baseline can be regenerated to match the checked-in `package.json`.
- `npm run ci:gates` and `npm run audit:high` can pass together on the tracked
  dependency graph.
- Storybook testing helpers remain available through the Cockpit workspace
  dependency declaration instead of the root production graph.
- No enforcement semantics were weakened.
