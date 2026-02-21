---
name: qa-agent-browser
description: Run deterministic browser QA using agent-browser. Produce QA report + trace/screenshot evidence.
disable-model-invocation: true
argument-hint: '[baseUrl] [storiesPath|-] [mode=sweep|smoke|verify|fix]'
allowed-tools: Read, Grep, Glob, Bash(agent-browser:*), Bash(mkdir *)
---

# QA with agent-browser

## Outputs

- `reports/qa/QA_REPORT.md`
- `qa-artifacts/<date>/screenshots/`
- `qa-artifacts/<date>/traces/`
- `qa/bugs/*.md` (if failures)
- `qa/repros/*.sh` (if failures)

## Hard rules

1. Use the deterministic ref workflow:
   - `agent-browser open <url>`
   - `agent-browser snapshot -i -C --json`
   - Interact ONLY via refs (`@e1`, `@e2`, ...) from the latest snapshot.
   - Re-snapshot after any navigation or DOM change (refs become invalid).
2. Prefer `--json` output for anything you will assert/compare.
3. For every failure: collect screenshot, trace, console + page errors, and write a bug file.
4. Use one stable session: `--session-name qa-${CLAUDE_SESSION_ID}`

## Modes

- **sweep**: Full test matrix from stories/specs.
- **smoke**: App loads, no console errors, primary workflow works.
- **verify**: Only rerun existing repro scripts in `qa/repros/`.
- **fix**: Reproduce bugs, identify root cause, implement fix, re-verify.

## Steps

1. Confirm app is reachable at baseUrl.
2. Confirm agent-browser is installed.
3. Create artifact folders.
4. Build test matrix from stories (or do smoke if none provided).
5. Execute each scenario with trace capture.
6. For failures: screenshot + trace + bug file + repro script.
7. Write `reports/qa/QA_REPORT.md` with coverage summary and bug list.
