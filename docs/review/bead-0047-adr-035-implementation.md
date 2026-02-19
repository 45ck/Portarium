# Bead-0047 ADR-035 Implementation Review

## Scope

Finalized Domain Atlas reproducibility pipeline as a CI job with artifact validation.

## Implemented

- Added Domain Atlas artifact validator:
  - `scripts/domain-atlas/validate-artifacts.mjs`
  - Validates source manifests, CIF snapshots, mappings, and capability matrices against JSON schemas.
  - Enforces pinned-commit consistency between `domain-atlas/sources/*/source.json` and `domain-atlas/extracted/*/cif.json`.
  - Requires extracted CIF presence for sources marked `status: DONE`.
  - Emits report: `reports/domain-atlas/validation-summary.json`.
- Added npm commands:
  - `domain-atlas:validate`
  - `domain-atlas:ci` (index regenerate + validation + drift check)
- Added dedicated CI job:
  - `.github/workflows/ci.yml` job `domain_atlas`
  - Runs `npm run domain-atlas:ci`
  - Uploads `reports/domain-atlas/` artifact
- Updated research docs/spec references:
  - `docs/research/README.md`
  - `.specify/specs/vaop-mvp-domain-atlas-research-programme.md`
- Regenerated research index for deterministic output:
  - `docs/research/index.md`

## Verification

- `npm run domain-atlas:validate` passes.
- `npm run typecheck` passes.
- `npm run ci:pr` still fails at existing gate baseline mismatch (`package.json`, missing `knip.json`, and now `.github/workflows/ci.yml` hash mismatch), unchanged gating mechanism.
