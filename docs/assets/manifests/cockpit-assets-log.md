# Cockpit Asset Generation Log

## Purpose

Track provenance and review state for assets used by `apps/cockpit`.

## Manifest source of truth

- `apps/cockpit/src/assets/manifest.json`
- `apps/cockpit/src/assets/manifest.schema.json`

## Batch 2026-02-20 (initial scaffold)

- Model: `gemini-3-pro-image-preview` (prompt catalog references stored)
- Prompt catalog: `docs/assets/prompts/cockpit-entity-assets.yml`
- Asset count: 13
- Scope:
  - Domain icons (isometric): robot, drone, agent, adapter, mission, evidence, policy, fleet
  - Entity images: 2 robot images, 2 agent images
  - 1 fleet illustration
- Status: `draft` (pending human curation/replacement with final generated set)

## Operator notes

- This batch establishes pathing, naming, and manifest contracts for cockpit integration.
- Placeholder SVG assets are committed so UI wiring and CI checks run deterministically.
- Replace draft assets in place after curated generation and keep the same IDs.
