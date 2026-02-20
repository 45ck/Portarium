# Bead 0586 Review - Cockpit Domain Icons + Transparent Pipeline

## Scope

- Expanded cockpit domain icon coverage with new icon assets:
  - `approval`, `human-task`, `workforce`, `run`
  - `queue`, `machine`, `map-layer`, `location-event`, `port`, `project`
- Added/updated generation prompt coverage in `docs/assets/prompts/cockpit-entity-assets.yml` and manifest references in `apps/cockpit/src/assets/manifest.json`.
- Added transparent-background pipeline script: `scripts/assets/chroma-key-icons.mjs`.

## Verification

Commands run:

```bash
npm run cockpit:assets:generate -- --ids icon-map-layer,icon-location-event,icon-port,icon-project --background transparent
npm run cockpit:assets:icons:transparent -- --background white
npm run cockpit:assets:check
```

Result:

- `cockpit:assets:check` passed (`validate` + orphan checks).
- Domain icon PNGs now include alpha channel and transparent pixels (`alphaMin=0`, `alphaMax=255`).

## Notes

- Bead closed after asset and manifest consistency validation.
