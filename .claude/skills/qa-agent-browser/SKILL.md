---
name: qa-agent-browser
description: Run a browser QA sweep and record evidence (traces/screenshots) for UI or flow changes.
disable-model-invocation: true
argument-hint: '[baseUrl] [mode=sweep|smoke|verify]'
allowed-tools: Read, Grep, Glob
---

# QA (Browser)

## Evidence

- Write `reports/qa/QA_REPORT.md`.
- If failures: create `qa/bugs/*.md` using `templates/bug.md`.
