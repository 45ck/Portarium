# Contributor Onboarding

This guide is the self-serve onboarding path for engineers contributing to Portarium.

## 1) Read In This Order

1. `CLAUDE.md` (project rules and required workflow order)
2. `docs/glossary.md` (ubiquitous language)
3. `AGENTS.md` (agent-specific operating rules)
4. `docs/getting-started/dev-workflow.md` (day-to-day delivery flow)
5. `docs/development-start-here.md` (current execution-critical backlog path)

## 2) Beads Basics

All work is tracked in Beads (`.beads/issues.jsonl`), one JSON object per line.

Core fields used by the workflow:

- `id`: `bead-####`
- `title`: short work statement
- `status`: `open` or `closed`
- `priority`: `P0` | `P1` | `P2` | `P3` (optional)
- `phase`: delivery phase label (optional)
- `blockedBy`: prerequisite bead IDs (optional)
- `body`: acceptance details / notes (optional)
- `claimedBy`: active owner (optional)
- `claimedAt`: UTC claim timestamp (optional)
- `createdAt`, `updatedAt`: UTC timestamps

Minimal example:

```json
{
  "id": "bead-0187",
  "title": "Onboarding guide",
  "status": "open",
  "priority": "P1",
  "phase": "governance",
  "blockedBy": [],
  "createdAt": "2026-02-20T00:00:00.000Z",
  "updatedAt": "2026-02-20T00:00:00.000Z"
}
```

## 3) Bead Lifecycle (One Bead At A Time)

Pick and inspect:

```bash
npm run bd -- issue next --priority P1
npm run bd -- issue view bead-XXXX --json
```

Start before implementation (claims bead + creates worktree):

```bash
npm run bd -- issue start bead-XXXX --by "<owner>"
```

If pausing or handing off (manual fallback):

```bash
npm run bd -- issue unclaim bead-XXXX --by "<owner>"
```

Finish when complete:

```bash
npm run bd -- issue finish bead-XXXX
```

## 4) Review And Closure Requirements

Before calling a bead done:

1. Spec alignment:
   `Spec -> Tasks -> Implement -> Tests -> Quality gates -> Review -> QA -> Merge`.
2. Tests are added/updated for behavior changes.
3. Relevant spec/ADR docs are updated when behavior or architecture changes.
4. Required review evidence is documented under `docs/internal/review/` when applicable.
5. Full gate is attempted:

```bash
npm run ci:pr
```

6. If blocked by known repository-wide baseline failures, capture that explicitly in review evidence.

Use prerequisite checks when needed:

```bash
node scripts/beads/check-bead-prerequisites.mjs bead-XXXX --json
node scripts/beads/check-bead-prerequisites.mjs --next --json
```

## 5) Definition Of Done (Contributor Level)

- Bead is started during active work.
- Implementation and tests are complete for the bead scope.
- Documentation/spec updates are included.
- Review evidence is recorded where required.
- Quality gates are run (or failure reason is documented).
- Bead is finished (or unclaimed if not finished).
