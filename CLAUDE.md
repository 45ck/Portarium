# Portarium (VAOP) -- Project Rules

## Autonomous issue loop

If the user says "continue working on issues", "work on the next issue", "keep going", or similar — read `AGENT_LOOP.md` at the repo root and follow it exactly. That file defines the full pick → claim → implement → ci:pr → finish → push → repeat cycle.

## Workflow order (always follow)

Spec → Tasks (bd) → Implement → Tests → Quality gates → Review → QA → Merge.

## Non-negotiables

- Run `npm run ci:pr` before claiming any work is done.
- No new public API without a contract (types + boundary test).
- Update `.specify/specs/` for behaviour changes; add ADR under `docs/adr/` for design changes.
- Use `bd` (Beads) for all work tracking; commit `.beads/issues.jsonl` with code changes.
  - Before picking/claiming any bead: `git fetch origin --prune && git pull --rebase origin main`, then check remote bead state (`bd sync --status` when available).
  - Start a bead before implementation: `npm run bd -- issue start <id> --by "<owner>"`
    (claims the bead + creates a git worktree at `.trees/<id>/`).
  - Immediately publish the claim to remote after `issue start`: commit `.beads/issues.jsonl`, run `npm run bd:sync`, then `git push origin main`.
  - Re-check claim ownership after sync/pull (`npm run bd -- issue view <id>`). If claim is no longer yours, unclaim and pick another ready bead.
  - Work inside `.trees/<id>/` — **do not run npm/bun install**. Instead junction-link node_modules from the repo root (instant, zero disk):
    ```bash
    node -e "const fs=require('fs'),p=require('path'),r=p.resolve('../..');const l=(s,d)=>{if(!fs.existsSync(d))fs.symlinkSync(s,d,'junction')};l(p.join(r,'node_modules'),'node_modules');l(p.join(r,'apps/cockpit/node_modules'),'apps/cockpit/node_modules')"
    ```
    Then implement + `npm run ci:pr`.
  - Finish when done (from repo root): `npm run bd -- issue finish <id>`
    (merges branch, removes worktree, closes bead).
  - Commit bead state after start/finish: `git add .beads/issues.jsonl && git commit -m "chore: start/close <id>"`.
  - Session end is not complete until all local commits are pushed (`git pull --rebase`, `npm run bd:sync`, `git push origin main`, confirm `git status` is up to date).
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

## Browser-based QA (agent-browser)

- For any manual QA, exploratory testing, or pre-test UI exploration, use `agent-browser` via the Node.js wrapper (the Rust binary is blocked by AppLocker on Windows Enterprise):
  ```bash
  npm run ab -- open http://cockpit.localhost:1355 --headed   # launch browser
  npm run ab -- snapshot -i                           # get interactive elements with refs
  npm run ab -- click @e2                             # interact by ref
  npm run ab -- fill @e3 "test value"                 # fill inputs
  npm run ab -- screenshot ./evidence.png             # capture evidence
  npm run ab -- close                                 # close browser
  ```
- Always re-snapshot after page navigation or DOM changes to get fresh refs.
- Start the cockpit dev server first: `npm run cockpit:dev` (stable URL: `http://cockpit.localhost:1355`)
- The wrapper (`scripts/ab.mjs`) speaks the same TCP protocol as the native CLI.

## Commands

- Quick check: `npm run ci:pr`
- Deep check: `npm run ci:nightly`
- Tests: `npm run test` or `npm run test:watch`
- Lint fix: `npm run lint:fix && npm run format`
- Browser QA: `npm run ab -- <command>`

## Naming conventions

- Use ubiquitous language from `docs/glossary.md` — one concept, one name.
- Commands (imperative): `ActivateSubscription`, `CancelWorkflow`
- Events (past tense): `WorkflowActivated`, `ApprovalGranted`
- Domain primitives: branded types (`TenantId`, `WorkflowId`, etc.)
