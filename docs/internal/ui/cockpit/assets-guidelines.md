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
  - `/assets/icons/domain/*.png`
  - `/assets/images/robots/*.(webp|png)`
  - `/assets/images/agents/*.(webp|png)`
  - `/assets/illustrations/*.(webp|png)`

## Background and transparency rules

- Domain icons should be committed as transparent PNGs.
- Generation can use white/green/blue backgrounds when needed, then convert with:
  - `npm run cockpit:assets:icons:transparent`
- Optional controls:
  - `--background auto|white|green|blue|#RRGGBB` (`auto` samples corner pixels)
  - `--threshold <number>`
  - `--softness <number>`
  - `--dry-run`

## Generation workflow

1. Add/update prompt in `docs/assets/prompts/cockpit-entity-assets.yml`.
2. Generate images with:
   - `npm run cockpit:assets:generate -- --kind <icon|image|illustration> [--ids ...] [--background white]`
3. Convert icon backgrounds to transparency:
   - `npm run cockpit:assets:icons:transparent`
4. Curate outputs under `apps/cockpit/public/assets/...`.
5. Update manifest entries (paths, alt, generator metadata, promptRef, status).
6. Run:
   - `npm run cockpit:assets:check`
   - `npm run cockpit:assets:optimize`
7. Commit assets, manifest changes, and prompt updates together.

## Quality checks

- CI runs validation and orphan checks.
- SVGs are optimized in CI and should not produce diffs after optimization.
- Missing manifest references or orphan files fail CI.
