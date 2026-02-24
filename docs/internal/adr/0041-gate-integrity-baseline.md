# ADR-0041: Gate Integrity Baseline

## Status

Accepted

## Context

Portarium relies on a layered gate stack (typecheck, lint, formatting, spelling, architecture boundaries, dead-code checks, tests/coverage, mutation tests) to keep the control plane maintainable and safe.

The configurations that define those gates (e.g. `eslint.config.mjs`, `tsconfig.json`, CI workflows, coverage thresholds) are as security/quality-critical as production code:

- A small config change can silently weaken enforcement (e.g. relaxed thresholds, added ignores, disabled rules).
- CODEOWNERS and human review help, but they do not mechanically guarantee that gate changes are intentional and explicitly acknowledged.

We want an explicit, deterministic signal in CI when gate-defining files change.

## Decision

Introduce a **Gate Integrity Baseline**:

- A checked-in baseline file: `.ci/gate-baseline.json`
- A curated critical-file list and hashing logic: `scripts/ci/gate-baseline.shared.mjs`
- A CI check that fails on unexpected changes: `scripts/ci/check-gate-baseline.mjs`
- A baseline updater: `scripts/ci/update-gate-baseline.mjs`

The baseline stores a SHA-256 hash for each "critical gate file". CI fails if:

- Any critical gate file changes without a corresponding baseline update, or
- The baseline does not exactly match the expected critical file list.

To keep hashing stable across Windows/Linux checkouts:

- `.gitattributes` enforces LF line endings for common text formats.
- The hasher normalizes CRLF to LF before hashing.

## Process

- If you modify a critical gate file, you must also run `npm run ci:gates:update-baseline`.
- If the change weakens/changes enforcement semantics (thresholds, ignored paths, disabled rules), add/update an ADR explaining why.

## Consequences

Positive:

- Prevents accidental or "drive-by" weakening of quality/architecture/test gates.
- Makes gate changes explicit in PRs (baseline diff is an obvious signal).
- Fails fast in CI before running slower checks.

Negative:

- Adds friction: legitimate gate edits require updating the baseline.
- Not a security boundary: a malicious committer can still change both the gate and the baseline.
- Requires maintenance: the critical file list must be kept accurate and intentionally small.

## Alternatives Considered

- **Rely on CODEOWNERS only**: helpful, but does not mechanically detect gate drift.
- **Rely on pre-commit hooks only**: local-only and easy to bypass; CI remains authority.
- **Signed commits / protected branches**: valuable but orthogonal; does not directly detect gate drift inside a PR.
