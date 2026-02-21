# Portarium (VAOP) -- Project Rules

## Workflow order (always follow)

Spec → Tasks (bd) → Implement → Tests → Quality gates → Review → QA → Merge.

## Non-negotiables

- Run `npm run ci:pr` before claiming any work is done.
- No new public API without a contract (types + boundary test).
- Update `.specify/specs/` for behaviour changes; add ADR under `docs/adr/` for design changes.
- Use `bd` (Beads) for all work tracking; commit `.beads/issues.jsonl` with code changes.
  - Start a bead before implementation: `npm run bd -- issue start <id> --by "<owner>"`
    (claims the bead + creates a git worktree at `.trees/<id>/`).
  - Work inside `.trees/<id>/` — run `npm install` there first, then implement + `npm run ci:pr`.
  - Finish when done (from repo root): `npm run bd -- issue finish <id>`
    (merges branch, removes worktree, closes bead).
  - Commit bead state after start/finish: `git add .beads/issues.jsonl && git commit -m "chore: start/close <id>"`.
  - For manual control: `bd issue claim` / `bd issue unclaim` still available.
  - If `bd` isn't installed globally, use `npm run bd -- ...` (e.g. `npm run bd -- issue list --json`).
- Upstream `bd` binary (global) for sync, daemon, hooks, dep tracking:
  - `bd ready` — show unblocked beads ready to work on
  - `bd sync` — push issue state to `beads-metadata` branch on GitHub (run after start/finish)
  - `bd doctor` — verify database health
  - `bd dep <id> <dep-id>` — record dependency between beads
  - `bd prime` — inject workflow context into Claude session
  - `npm run bd:daemon:start` / `npm run bd:daemon:stop` — background auto-flush daemon
  - SQLite DB (`.beads/beads.db`) is gitignored; `issues.jsonl` is the portable source of truth
- For UI/user-flow changes: run `/qa-agent-browser` and attach traces/screenshots.
- Domain code (`src/domain/`) must have zero external dependencies (no infra, no presentation imports).
- All domain types use branded primitives from `src/domain/primitives/`.
- Hybrid architecture boundary is fixed: orchestration for run correctness + CloudEvents for external choreography (ADR-0070).

## Architecture layers (enforced by dependency-cruiser)

- `src/domain/` — entities, value objects, domain rules, domain events (no HTTP/DB)
- `src/application/` — use-cases, orchestration, transactions, permissions
- `src/infrastructure/` — DB, external APIs, queues, adapters
- `src/presentation/` — HTTP handlers, UI, CLI

## Commands

- Quick check: `npm run ci:pr`
- Deep check: `npm run ci:nightly`
- Tests: `npm run test` or `npm run test:watch`
- Lint fix: `npm run lint:fix && npm run format`

## Naming conventions

- Use ubiquitous language from `docs/glossary.md` — one concept, one name.
- Commands (imperative): `ActivateSubscription`, `CancelWorkflow`
- Events (past tense): `WorkflowActivated`, `ApprovalGranted`
- Domain primitives: branded types (`TenantId`, `WorkflowId`, etc.)
