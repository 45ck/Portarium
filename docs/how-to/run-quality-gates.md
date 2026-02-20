# How-To: Run Quality Gates

Run full PR quality gates before opening or updating a PR.

```bash
npm run ci:pr
```

This runs gate baseline checks, typecheck, lint, format check, spellcheck, dependency-cruiser, knip, coverage, and vulnerability audit threshold checks.

## Deep nightly checks

```bash
npm run ci:nightly
```

## If a gate fails

1. Fix root cause.
2. Re-run only failed gate locally.
3. Re-run `npm run ci:pr`.

## Related docs

- `docs/reference/ci-and-quality.md`
- `docs/gate-checklist.md`
