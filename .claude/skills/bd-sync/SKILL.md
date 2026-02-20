---
name: bd-sync
description: Synchronise work with Beads (bd). Ensure current work is tracked, linked, and committed as evidence.
disable-model-invocation: true
argument-hint: "[issueId]"
allowed-tools: Read, Grep, Glob, Bash(bd *), Bash(git status), Bash(git diff *), Bash(git add *), Bash(git commit -m *)
---

# Beads Sync

## Outputs
- `.beads/issues.jsonl` updated
- `reports/quality/BD_STATUS.md`

## Steps
1. Ensure `bd` is available; if not, instruct user to install.
2. If issueId provided:
   - `bd show <id> --json`
   - `bd update <id> --status in_progress --json`
3. If no issueId:
   - `bd ready --json` — pick top priority unblocked issue.
4. After work:
   - `bd close <id> --reason "..." --json`
5. Write `reports/quality/BD_STATUS.md` summarising:
   - Issue worked
   - Status transitions
   - Related issues discovered
6. Ensure `.beads/issues.jsonl` staged for commit.
