---
name: bd-sync
description: Keep work tracked in Beads (bd) and ensure .beads/issues.jsonl is updated as evidence.
disable-model-invocation: true
argument-hint: '[issueId]'
allowed-tools: Read, Grep, Glob, Bash(bd *), Bash(git status), Bash(git diff *)
---

# Beads Sync

## Notes

- Work must be tracked in Beads and `.beads/issues.jsonl` must be committed with code changes.
- Prefer `bd ... --json` for machine-readable output.
