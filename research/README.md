# Research Workspace

This folder holds the **manifest** and **pins** for upstream repos we study (Domain Atlas / ADR-0035) without committing upstream code into Portarium.

- Upstream clones live in `research/sources/` (gitignored).
- Research notes live in `docs/research/` (committed).
- Source list lives in `research/manifest.json` (committed).
- Commit pins live in `research/pins.json` (committed).

Workflow:

1. Add/edit sources in `research/manifest.json`.
2. Run `npm run research:sync` to clone missing sources and refresh `research/pins.json`.
3. Run `npm run research:index` to regenerate `docs/research/index.md`.

Project rule reminder (ADR-019): pattern extraction only; no code copying.
