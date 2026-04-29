# Experiment B Setup

Run from the repository root:

```bash
node experiments/exp-B-fail-closed/run.mjs
```

The script is deterministic and does not require a live Portarium server. It compiles the local OpenClaw plugin package, registers the real `before_tool_call` hook in a minimal OpenClaw-compatible harness, and points the plugin at an unreachable local URL.

Useful overrides:

```bash
PORTARIUM_FAIL_CLOSED_URL=http://127.0.0.1:1 node experiments/exp-B-fail-closed/run.mjs
```

Results are written to:

```text
experiments/exp-B-fail-closed/results/outcome.json
```
