# Research Notes

This folder is the committed documentation for ongoing upstream research (Domain Atlas / ADR-0035).

Single source of truth for upstream intake metadata: `domain-atlas/sources/*/source.json`.

- Upstream clones (gitignored): `domain-atlas/upstreams/`
- Source intake manifests (committed): `domain-atlas/sources/`
- Provider decision notes (committed): `domain-atlas/decisions/providers/`
- Index (generated): `docs/research/index.md`

Commands:

- `npm run domain-atlas:vendor` clone missing upstreams and pin missing commits in source manifests
- `npm run domain-atlas:index` regenerate `docs/research/index.md` from Domain Atlas sources
