---
name: quality-check
description: Run the full quality gate suite and write merge evidence to reports/quality/.
disable-model-invocation: true
argument-hint: '[mode=pr|nightly]'
allowed-tools: Read, Grep, Glob, Bash(npm ci), Bash(npm run *)
---

# Quality Check

## Command

- Default: `npm run ci:pr`
- Deep: `npm run ci:nightly`

## Evidence

- Write `reports/quality/QUALITY_REPORT.md` with:
  - Date/time
  - Command run
  - Pass/fail
  - If failed: exact failing command(s) and next action
