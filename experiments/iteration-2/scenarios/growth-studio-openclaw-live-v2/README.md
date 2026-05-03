# Growth Studio OpenClaw Live v2

Owner Bead: `bead-1042`

Status: runnable deterministic replay.

## Scenario

OpenClaw proposes multiple governed Actions. At least one Approval Gate remains
pending across a long delay window, then an operator approves it. The agent must
resume the blocked step exactly once without replaying prior writes.

## Required Variants

- `live-wait`: the agent process remains alive while blocked.
- `restart-resume`: the proposal survives process exit and later recovery.

## Required Evidence

- pending approval remains durable across the delay window
- resume latency after approval is measured
- duplicate execution count is zero
- evidence chain is continuous before wait, during wait, and after resume
- report compares this result to the original Growth Studio live run

## Run

```bash
node experiments/iteration-2/scenarios/growth-studio-openclaw-live-v2/run.mjs
```

The default runner is deterministic and does not require live LLM credentials.
It models the two required variants (`live-wait` and `restart-resume`) and writes
`outcome.json`, `queue-metrics.json`, `evidence-summary.json`, and `report.md`.
By default the deterministic attempt is written under
`experiments/iteration-2/results/growth-studio-openclaw-live-v2/deterministic-growth-v2`,
and the artifact payloads use the attempt directory name as their `attemptId`.
Live provider-backed reruns should use the same result contract and append a new
attempt directory instead of overwriting this deterministic baseline.

## Live OpenClaw Rerun

```bash
PORTARIUM_LIVE_OPENCLAW_RERUNS=true \
PORTARIUM_EXPERIMENT_LIVE_LLM=true \
PORTARIUM_LIVE_MODEL_PROVIDER=openai \
OPENAI_API_KEY=... \
node experiments/iteration-2/scenarios/growth-studio-openclaw-live-v2/run.mjs \
  --results-dir experiments/iteration-2/results/growth-studio-openclaw-live-v2/live-openclaw-rerun-v1
```

The live path still skips unless the explicit live OpenClaw env var, live model
opt-in, provider selector, and matching credential are present. It records
redacted provider/model metadata, Approval IDs, queue metrics, Evidence
Artifacts, exact-once resume results, and comparison with
`deterministic-growth-v2` in `live-rerun-metadata.json`.
