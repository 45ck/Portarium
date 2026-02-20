# Cockpit Asset Guidelines

## Scope

This guideline covers visual assets for the high-fidelity cockpit app in `apps/cockpit`.

## Style policy

- Use a hybrid system:
  - Realistic imagery for entity detail/context cards.
  - Isometric 3D icons for domain concepts and compact list/navigation surfaces.
- Keep Lucide icons for generic UI controls:
  - search, filter, settings, notifications, generic actions.

## Asset contract

- Manifest is mandatory for committed assets:
  - `apps/cockpit/src/assets/manifest.json`
- Validate against:
  - `apps/cockpit/src/assets/manifest.schema.json`
- Every non-decorative asset must include meaningful `alt` text.

## Naming conventions

- IDs: kebab-case (`icon-robot-ground`, `image-agent-ops-analyst`)
- Paths:
  - `/assets/icons/domain/*.svg`
  - `/assets/images/robots/*.(webp|png|svg)`
  - `/assets/images/agents/*.(webp|png|svg)`
  - `/assets/illustrations/*.(webp|png|svg)`

## Generation workflow

1. Add/update prompt in `docs/assets/prompts/cockpit-entity-assets.yml`.
2. Generate images manually in Gemini/Nano Banana Pro.
3. Curate outputs and place selected files under `apps/cockpit/public/assets/...`.
4. Update manifest entries (paths, alt, generator metadata, promptRef, status).
5. Run:
   - `npm run cockpit:assets:check`
   - `npm run cockpit:assets:optimize`
6. Commit assets, manifest changes, and prompt updates together.

## Quality checks

- CI runs validation and orphan checks.
- SVGs are optimized in CI and should not produce diffs after optimization.
- Missing manifest references or orphan files fail CI.
