# Bead-0704 Review: Security Baseline Gates

## Scope

- Establish CI baseline gates for dependency review, CodeQL, and OpenSSF Scorecards.
- Ensure local security-gate command exists and is wired in workflow automation.

## Changes

- Updated `.github/workflows/security-gates.yml`:
  - Added pull-request dependency review gate (`actions/dependency-review-action@v4`).
  - Scoped push trigger to `main` and added `workflow_dispatch`.
- Added `.github/workflows/codeql.yml`:
  - Dedicated CodeQL analysis workflow for PRs, merge groups, `main`, and weekly schedule.
- Added `.github/workflows/scorecards.yml`:
  - OpenSSF Scorecards workflow with code-scanning findings upload.
- Updated `package.json`:
  - Added `ci:security-gates` script wired to the high/critical audit gate.
- Added `docs/how-to/security-baseline-gates.md`:
  - Operational documentation for the new baseline gates.

## Validation

- `npm run ci:pr`
