# ADR-0154: Playwright CI Runner Compatibility

## Status

Proposed in the CI delivery guidance PR.

## Context

The PR job uses Playwright 1.58.2 from the lockfile. Its browser installer rejects
`ubuntu26.04-x64` after `ubuntu-latest` moves to that image. The versioned
[Playwright browser registry](https://github.com/microsoft/playwright/blob/v1.58.2/packages/playwright-core/src/server/registry/index.ts)
provides Ubuntu 24.04 bundles.

[ADR-0041](0041-gate-integrity-baseline.md) requires an updated integrity baseline
for critical gate files. The runner change updates `.github/workflows/ci.yml`.
The existing `package.json` hash was already different from its recorded baseline
before this PR; this PR leaves that manifest untouched.

## Decision

Pin only the existing PR browser job to `ubuntu-24.04`. Preserve its commands,
triggers, permissions, database services, quality requirements and dependent
mutation job. Record the changed workflow hash in `.ci/gate-baseline.json`.

Run the existing baseline updater, then retain the original recorded
`package.json` hash so the unrelated drift still requires review. All other
recorded hashes stay unchanged.

## Evidence and consequences

The candidate passed dependency installation, browser installation, migration
validation and migrations against the test database. YAML comparison verified
that only the PR job runner label changed. Repository formatting checks passed.

The integrity checker still reports the existing `package.json` mismatch.
Existing script wiring, security and service configuration failures remain
visible. The required full PR gate must pass before merge.
