# Security Baseline Gates

This repository enforces a baseline CI security posture through three GitHub Actions workflows:

1. Dependency review on pull requests.
2. CodeQL analysis on pull requests and `main`.
3. OpenSSF Scorecards analysis on `main` and weekly schedule.

## Workflows

- `.github/workflows/security-gates.yml`
  - Runs `actions/dependency-review-action` for pull requests.
  - Runs repository security checks via `npm run ci:security-gates`.
- `.github/workflows/codeql.yml`
  - Runs CodeQL scanning for JavaScript on pull requests, merge groups, `main`, and weekly schedule.
- `.github/workflows/scorecards.yml`
  - Runs OpenSSF Scorecards on `main`, branch-protection changes, and weekly schedule.
  - Publishes code-scanning findings to GitHub.

## Local equivalent check

Run the local security gate command:

```bash
npm run ci:security-gates
```

This currently enforces high/critical production dependency vulnerability checks via `npm audit`.
