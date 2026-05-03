# ADR-0144: Beads Sync Compatibility Wrapper

## Status

Accepted

## Context

Portarium's autonomous-agent workflow requires `npm run bd:sync` during claim,
finish, and session handoff. The repository documentation historically mapped
that script directly to upstream `bd sync`.

On Windows agents with upstream `bd` 0.61.0, `bd sync` is no longer exposed, and
the modern `bd import` command expects numeric issue priorities. Portarium's
tracked `.beads/issues.jsonl` intentionally stores priorities as `P0` through
`P3` for the repo-local `scripts/beads/bd.mjs` workflow. Calling `bd import`
directly therefore fails on valid repository state.

## Decision

Replace the package-level `bd:sync` command with a compatibility wrapper:

- Try upstream `bd sync` first, preserving existing behaviour when available.
- If upstream reports that `sync` is unknown, create a temporary JSONL import
  file that converts `P0`/`P1`/`P2`/`P3` to numeric priorities for upstream
  `bd import`.
- Leave the tracked `.beads/issues.jsonl` unchanged.
- If a worktree-local Dolt database exists but lacks the expected `bead`
  database, create that database non-destructively and retry import.

The gate baseline is regenerated because `package.json` is a critical gate file
under ADR-0041.

## Consequences

- `npm run bd:sync` is usable on both older workflows with `bd sync` and modern
  `bd` installations with `bd import`.
- Git remains the portable source of truth for `.beads/issues.jsonl`.
- The wrapper does not restore metadata-branch federation semantics if a future
  upstream `bd` version changes that flow again; it only preserves the mandatory
  local sync/import step needed by Portarium agents.
