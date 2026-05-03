# OpenClaw Concurrent Sessions

Owner Bead: `bead-1044`

Status: runnable deterministic concurrency.

## Scenario

Several governed OpenClaw sessions run at the same time. Each session proposes,
waits, resumes, and writes to its own output bundle. Operators resolve approvals
in mixed order across active sessions.

## Required Evidence

- approval IDs, Evidence Artifacts, and outputs remain session-scoped
- a decision for one session never unblocks another session
- throughput and latency are recorded for the selected concurrency level
- duplicate execution count is zero when approvals resolve near-simultaneously
- final report states tested concurrency level and observed bottlenecks

## Run

```bash
node experiments/iteration-2/scenarios/openclaw-concurrent-sessions/run.mjs
```

The default runner uses four deterministic concurrent sessions. It writes
`outcome.json`, `queue-metrics.json`, `evidence-summary.json`, and `report.md`,
and records mixed-order decisions, per-session Evidence Artifact chains, output
bundle paths, throughput, and observed bottlenecks.

## Live OpenClaw Rerun

```bash
PORTARIUM_LIVE_OPENCLAW_RERUNS=true \
PORTARIUM_EXPERIMENT_LIVE_LLM=true \
PORTARIUM_LIVE_MODEL_PROVIDER=openai \
OPENAI_API_KEY=... \
node experiments/iteration-2/scenarios/openclaw-concurrent-sessions/run.mjs \
  --results-dir experiments/iteration-2/results/openclaw-concurrent-sessions/live-openclaw-rerun-v1
```

The live path requires the explicit live OpenClaw env var and an explicit live
model provider. It records redacted provider/model metadata, session-scoped
Approval IDs, queue metrics, Evidence Artifacts, exact-once resume results, and
comparison with `deterministic-concurrency-v1` in `live-rerun-metadata.json`.
