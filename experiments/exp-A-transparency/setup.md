# Experiment A Setup

## Local deterministic run

Run from the repository root:

```bash
node experiments/exp-A-transparency/run.mjs
```

The script builds the real `packages/openclaw-plugin` TypeScript package, loads
the built hook/client modules, starts a deterministic local Portarium-compatible
HTTP surface, and registers the hook in a minimal OpenClaw-compatible harness.

No live control plane, browser, or LLM credential is required for the default
run.

## Optional output location

```bash
node experiments/exp-A-transparency/run.mjs --results-dir .tmp/exp-a-results
```

The runner writes `outcome.json` under the selected results directory. Committed
`experiments/**/results/` files are intentionally ignored except `.gitkeep`.

## What the runner exercises

1. `read:file` with `{ "path": "README.md" }` should return `Allow` and execute.
2. `write:file` with a target file payload should return `NeedsApproval`, expose
   an initially pending approval, then unblock only after the deterministic
   operator approval.
3. `shell.exec` with `{ "command": "rm -rf /tmp/portarium-exp-a" }` should return
   `Denied` and never execute the tool body.
