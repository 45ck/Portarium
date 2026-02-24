# Repo Hygiene Runbook

Use this runbook to keep repository structure stable and avoid local artifact sprawl.

## Daily (local)

1. Review structure checks:

```bash
npm run repo:check:organization
```

2. Preview local cleanup actions:

```bash
npm run repo:cleanup:local -- --dry-run
```

3. Apply cleanup when output looks correct:

```bash
npm run repo:cleanup:local
```

## Weekly (maintainer)

1. Audit docs placement:

```bash
npm run docs:layout:check
npm run docs:discoverability:check
```

2. Audit Domain Atlas upstream footprint:

```bash
npm run domain-atlas:upstreams:audit
```

3. Check for oversized provider worktrees (example budget):

```bash
npm run domain-atlas:upstreams:audit -- --max-total-mb 200 --max-provider-mb 100 --fail-on-orphans
```

## Policy

- Internal governance/review artifacts belong under `docs/internal/`.
- Manual QA evidence belongs under `qa-artifacts/manual-evidence/`.
- Local scratch output belongs under `tmp/local-scratch/` or `.tmp/`.
- Do not commit generated runtime artifacts unless they are deliberate, documented fixtures.

