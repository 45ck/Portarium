# Repository Organization

This reference defines where files belong so docs, scripts, and generated artifacts do not drift.

## Top-level intent

- `src/`: product code (domain/application/infrastructure/presentation)
- `apps/`: app packages (Cockpit frontend and related assets)
- `docs/`: canonical project documentation
- `docs/internal/`: maintainer-only docs (ADRs, governance, review artifacts, internal UI design notes)
- `scripts/`: automation entry points invoked by npm scripts
- `domain-atlas/`: research pipeline sources, extracted artifacts, and optional local upstream worktrees
- `infra/`: deployment and infrastructure definitions

## Public vs internal docs

- Public docs stay under documented sections such as:
  - `docs/getting-started/`
  - `docs/how-to/`
  - `docs/reference/`
  - `docs/tutorials/`
  - `docs/explanation/`
- Internal-only materials live under `docs/internal/`.
- If a doc targets maintainer governance, review evidence, or internal planning, place it in `docs/internal/`.

## Artifacts and temporary outputs

- Runtime/manual evidence output belongs in `qa-artifacts/`.
- One-off local scratch files belong in `tmp/` or `.tmp/` (both ignored).
- Do not add screenshots/videos/log dumps to `docs/` unless they are intentional long-lived documentation assets.

## Domain Atlas upstream checkouts

- Local upstream clones/checkouts belong in `domain-atlas/upstreams/`.
- Use `npm run domain-atlas:vendor` to hydrate/pin sources.
- Use `npm run domain-atlas:upstreams:audit` to review footprint and detect unmanaged directories.

## Hygiene checks

- `npm run docs:layout:check`
- `npm run docs:discoverability:check`
- `npm run repo:check:organization`
- `npm run repo:cleanup:local -- --dry-run`

