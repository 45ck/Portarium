# Reference: CI and Quality

Portarium enforces quality gates through npm scripts and GitHub Actions workflows.

## Required local gate

```bash
npm run ci:pr
```

Current gate includes:

- gate baseline check
- typecheck
- lint
- format check
- spellcheck
- dependency-cruiser
- knip
- tests with coverage
- vulnerability audit threshold

## Nightly deep checks

```bash
npm run ci:nightly
```

Includes mutation testing, dep graph generation, strict knip, and slow typecheck.

## Workflows

- `.github/workflows/ci.yml`
- `.github/workflows/nightly.yml`
- `.github/workflows/ci-infra.yml`
- `.github/workflows/ci-images.yml`
- `.github/workflows/cd-k8s-deploy.yml`
- `.github/workflows/docs-lint.yml`
- `.github/workflows/links.yml`
- `.github/workflows/assets.yml`

## Related scripts

See `package.json` scripts for exact command definitions.
