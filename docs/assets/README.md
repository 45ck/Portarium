# Documentation Assets

This directory stores documentation visuals and prompt metadata.

## Layout

- `docs/assets/prompts/` - versioned prompt catalogs
- `docs/assets/manifests/` - human-readable asset generation logs
- `docs/assets/hero/` - hero images for README/docs
- `docs/assets/diagrams/` - static diagram exports
- `docs/assets/icons/` - icon packs

Cockpit runtime assets are stored in `apps/cockpit/public/assets/` and indexed by
`apps/cockpit/src/assets/manifest.json`.

## Provenance expectations

For generated assets, track:

- model id
- prompt id
- generation date
- operator
- output filename
- optional seed (if the tool supports it)

## Suggested naming

- `portarium-hero--light--16x9.png`
- `architecture--light--16x9.svg`
- `ci-pipeline--a11y--16x9.svg`
