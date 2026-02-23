# Portarium (VAOP) -- Agent Guidelines

## Autonomous issue loop

If you are told to "continue working on issues", "work on the next issue", "keep going", or similar — or if you are launched with `AGENT_LOOP.md` as your prompt — read `AGENT_LOOP.md` at the repo root. It contains the complete autonomous loop: pick → claim → worktree → implement → ci:pr → finish → push → repeat.

## For any AI agent working on this codebase

1. **Read CLAUDE.md first** — it contains the project rules and workflow order.
2. **Check `docs/glossary.md`** before naming anything — use the ubiquitous language.
3. **Never skip gates** — run `npm run ci:pr` before considering work complete.
4. **Track and claim work in Beads** — see the Beads Workflow section below.
5. **Respect architecture boundaries** — domain cannot import infrastructure or presentation.
6. **Write tests first** (or alongside) — coverage thresholds are enforced in CI (see `vitest.config.ts`).
7. **Update specs** — if behaviour changes, update `.specify/specs/` or reference existing spec.

## Available skills

- `/quality-check` — run full quality gate suite
- `/architecture-guard` — validate architecture boundaries
- `/review-fagan` — formal inspection-style review
- `/security-scan` — security scanning
- `/qa-agent-browser` — browser-based QA sweep
- `/bd-sync` — synchronise work with Beads

## Browser-Based QA (agent-browser)

For manual QA, exploratory testing, or UI exploration before writing tests, use `agent-browser` via the Node.js wrapper. The Rust binary is blocked by AppLocker on Windows Enterprise, so all beads requiring UI interaction must use the wrapper:

```bash
# Start the cockpit dev server first
cd apps/cockpit && npx vite

# Then in another terminal, use the wrapper:
npm run ab -- open http://localhost:5173 --headed   # launch browser
npm run ab -- snapshot -i                           # get interactive elements with refs
npm run ab -- click @e2                             # interact by ref
npm run ab -- fill @e3 "test value"                 # fill inputs
npm run ab -- screenshot ./evidence.png             # capture evidence
npm run ab -- close                                 # close browser
```

Key rules:
- **Always re-snapshot** after navigation or DOM changes — refs are invalidated by page updates.
- Use `snapshot -i` for interactive elements only (compact), or `snapshot` for the full accessibility tree.
- Use `screenshot --annotate` to get annotated screenshots with numbered labels mapped to refs.
- The wrapper (`scripts/ab.mjs`) speaks the same TCP protocol as the native CLI — all commands are supported.
- Sessions are isolated: use `AGENT_BROWSER_SESSION=mytest npm run ab -- open ...` for parallel sessions.

---

## Beads Workflow

### Architecture

```
npm run bd -- issue start/finish/list  →  scripts/beads/bd.mjs  (VAOP worktree integration)
bd ready / bd sync / bd dep / bd prime →  upstream bd binary    (sync, daemon, dep tracking)
.beads/issues.jsonl                    →  shared source of truth (committed to git)
```

### Starting Work

1. Pick an unblocked issue:

   ```bash
   git fetch origin --prune
   git pull --rebase origin main
   bd sync --status               # if global bd is unavailable, run: npm run bd:sync
   npm run bd:ready        # show issues ready to work (upstream bd)
   # or
   npm run bd -- issue list --status open
   ```

2. Start the issue (creates git worktree + claims the bead):

   ```bash
   npm run bd -- issue start <bead-id> --by "<your-name>"
   # e.g.: npm run bd -- issue start bead-0756 --by "claude"
   ```

3. Immediately publish the claim (required for multi-machine safety):

   ```bash
   git add .beads/issues.jsonl
   git commit -m "chore: start <bead-id>"
   git pull --rebase origin main
   npm run bd:sync
   git push origin main
   npm run bd -- issue view <bead-id>   # verify claimedBy is you
   ```

4. Enter the worktree and install deps:

   ```bash
   cd .trees/<bead-id>
   # Junction-link node_modules from root — instant, no install needed
   node -e "const fs=require('fs'),p=require('path'),r=p.resolve('../..');const l=(s,d)=>{if(!fs.existsSync(d))fs.symlinkSync(s,d,'junction')};l(p.join(r,'node_modules'),'node_modules');l(p.join(r,'apps/cockpit/node_modules'),'apps/cockpit/node_modules')"
   ```

5. Implement, then run the quality gate:
   ```bash
   npm run ci:pr
   ```

### Finishing Work

From the repo root (not inside the worktree):

```bash
npm run bd -- issue finish <bead-id>
# merges branch → main, removes worktree, closes bead
```

Then sync issue state to GitHub and commit:

```bash
git pull --rebase origin main
npm run bd:sync                      # push to beads-metadata branch
git add .beads/issues.jsonl
git commit -m "chore: close <bead-id>"
git push origin main
git status  # MUST show: "Your branch is up to date with 'origin/main'"
```

### Upstream bd Commands (global binary)

```bash
bd ready                     # show unblocked issues ready to claim
bd sync                      # push issue state to beads-metadata on GitHub
bd sync --status             # check sync status vs remote
bd doctor                    # verify database health
bd dep <id> <depends-on>     # record dependency between beads
bd dep list <id>             # show deps for an issue
bd prime                     # inject workflow context into current session
npm run bd:daemon:start      # start background auto-flush daemon (5s debounce)
npm run bd:daemon:stop       # stop daemon
```

### Claiming Without a Worktree

```bash
bd issue claim <bead-id>      # claim without creating worktree
bd issue unclaim <bead-id>    # release claim
```

### Cross-Machine Development

```
Machine A: npm run bd -- issue start bead-0719 --by "alice"
           git push origin bead-0719
           npm run bd:sync

Machine B: git fetch origin
           # post-merge hook auto-imports updated issues.jsonl
           git checkout bead-0719
           # continue work; git push when done

Machine A: npm run bd -- issue finish bead-0719
           npm run bd:sync
```

### Key Rules

- **Always** run `npm run ci:pr` before claiming work is done.
- **Commit** `.beads/issues.jsonl` alongside every code change that opens/closes a bead.
- **Sync + pull before claiming** and **push immediately after claiming** so other machines see the claim.
- **Sync** after start/finish so other machines see the updated state.
- **If claim ownership changes after sync/pull, unclaim locally and pick a different ready bead.**
- The SQLite database (`.beads/beads.db`) is gitignored — `issues.jsonl` is the portable format.
- Worktrees live in `.trees/<bead-id>/` and are gitignored.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
