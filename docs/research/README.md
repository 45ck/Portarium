# Research Notes

This folder is the committed documentation for ongoing upstream research (Domain Atlas / ADR-0035).

Single source of truth for upstream intake metadata: `domain-atlas/sources/*/source.json`.

- Upstream clones (gitignored): `domain-atlas/upstreams/`
- Source intake manifests (committed): `domain-atlas/sources/`
- Provider decision notes (committed): `domain-atlas/decisions/providers/`
- Port-family candidate ownership/blockers matrix: `docs/research/port-family-integration-candidate-matrix.md`
- Index (generated): `docs/research/index.md`

Commands:

- `npm run domain-atlas:vendor` clone missing upstreams and pin missing commits in source manifests
- `npm run domain-atlas:index` regenerate `docs/research/index.md` from Domain Atlas sources
- `npm run domain-atlas:ops-stubs` generate machine-readable per-family operation contract stubs from integration-catalog tables
- `npm run domain-atlas:ops-stubs:verify` verify operation stub completeness, canonical mapping consistency, and source-ranking assumptions
- `npm run domain-atlas:validate` validate source/CIF/mapping/capability artefacts and pinned commit consistency
- `npm run domain-atlas:readiness` verify candidate readiness (source intent + operation mapping + evidence chain) and emit `reports/domain-atlas/port-family-readiness.json`
- `npm run domain-atlas:ci` run index regeneration + artifact validation + drift check for CI
