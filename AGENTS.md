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
   npm run bd:ready        # show issues ready to work (upstream bd)
   # or
   npm run bd -- issue list --status open
   ```

2. Start the issue (creates git worktree + claims the bead):

   ```bash
   npm run bd -- issue start <bead-id> --by "<your-name>"
   # e.g.: npm run bd -- issue start bead-0756 --by "claude"
   ```

3. Enter the worktree and install deps:

   ```bash
   cd .trees/<bead-id>
   bun install   # fast via hardlink cache; subsequent worktrees take ~2-5s
   ```

4. Implement, then run the quality gate:
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
npm run bd:sync                      # push to beads-metadata branch
git add .beads/issues.jsonl
git commit -m "chore: close <bead-id>"
git push
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
- **Sync** after start/finish so other machines see the updated state.
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
