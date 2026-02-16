# Research Notes

This folder is the committed documentation for ongoing upstream research (Domain Atlas / ADR-0035).

- Upstream clones (not committed): `research/sources/`
- Source manifest (committed): `research/manifest.json`
- Commit pins (committed): `research/pins.json`
- Index (generated): `docs/research/index.md`
- Per-source notes: `docs/research/sources/*.md`

Commands:

- `npm run research:sync` clone missing sources and refresh pins
- `npm run research:index` regenerate index from manifest + pins
