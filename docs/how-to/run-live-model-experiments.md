# Run Live Model Experiments

Live model experiments are opt-in and must use the shared experiment runner
preflight. The shared preflight boundary covers OpenAI-compatible routes,
Claude-backed approval lifecycle runs, and Gemini-backed approval lifecycle
runs. Normal CI does not need API keys and does not make provider calls.

Add the gate to the experiment:

```ts
await runExperiment({
  name: 'my-live-model-experiment',
  liveModelPreflight: true,
  execute: async (ctx) => {
    const provider = ctx.liveModelPreflight?.provider;
    // Run the provider-backed experiment here.
  },
  verify: async () => [],
});
```

Run locally with a provider and credential:

```bash
PORTARIUM_EXPERIMENT_LIVE_LLM=true \
PORTARIUM_LIVE_MODEL_PROVIDER=openai \
OPENAI_API_KEY=... \
node experiments/my-live-model-experiment/run.mjs
```

Supported shared preflight provider selectors:

| Selector     | Credential source                                              | Optional model override                      |
| ------------ | -------------------------------------------------------------- | -------------------------------------------- |
| `openai`     | `OPENAI_API_KEY`                                               | `PORTARIUM_LIVE_MODEL` or `OPENAI_MODEL`     |
| `openrouter` | `OPENROUTER_API_KEY`                                           | `PORTARIUM_LIVE_MODEL` or `OPENROUTER_MODEL` |
| `codex`      | Codex CLI auth, or `CODEX_API_KEY`/`OPENAI_API_KEY`            | `PORTARIUM_LIVE_MODEL` or `CODEX_MODEL`      |
| `claude`     | `CLAUDE_API_KEY` or `ANTHROPIC_API_KEY`                        | `PORTARIUM_LIVE_MODEL` or `ANTHROPIC_MODEL`  |
| `gemini`     | `GEMINI_API_KEY`, `GOOGLE_API_KEY`, or `GOOGLE_VERTEX_API_KEY` | `PORTARIUM_LIVE_MODEL` or `GEMINI_MODEL`     |

If `PORTARIUM_LIVE_MODEL_PROVIDER` is omitted, the runner detects a provider from
the available credential env vars. If no credential is present, the experiment is
skipped before setup or execution.

The result bundle records the provider, model, probe endpoint kind, HTTP status,
and failure kind. Credential values, credential env var names, provider base
URLs, expected credential source lists, and CLI auth details are never written
to `results/outcome.json`.

For the Codex route without API-key env vars, the preflight runs a read-only
`codex exec` probe and records only `provider: "codex"` plus probe metadata
when local Codex auth is available.

Live approval lifecycle runs use the same default-disabled preflight boundary,
but require additional explicit approval-lifecycle gates before any provider
call. Treat these commands as optional manual evidence only; the default CI path
uses mocked provider responses and does not spend API quota:

```bash
PORTARIUM_EXPERIMENT_LIVE_LLM=true \
PORTARIUM_LIVE_APPROVAL_LIFECYCLE=true \
PORTARIUM_LIVE_APPROVAL_PROVIDER=claude \
ANTHROPIC_API_KEY=... \
node node_modules/vitest/vitest.mjs run scripts/integration/scenario-live-approval-lifecycle.test.ts
```

Supported live approval lifecycle providers:

| Selector | Credential source       | Default model       |
| -------- | ----------------------- | ------------------- |
| `claude` | `ANTHROPIC_API_KEY`     | `claude-sonnet-4-6` |
| `openai` | `OPENAI_API_KEY`        | `gpt-4o`            |
| `gemini` | `GOOGLE_VERTEX_API_KEY` | `gemini-2.0-flash`  |

The live approval lifecycle stays skipped unless both
`PORTARIUM_EXPERIMENT_LIVE_LLM=true` and
`PORTARIUM_LIVE_APPROVAL_LIFECYCLE=true` are set. It also requires an explicit
`PORTARIUM_LIVE_APPROVAL_PROVIDER`; credentials alone do not trigger live
provider calls. CI remains deterministic because these opt-in env vars are not
set in the default gate path.

Failure handling:

| Preflight status | Experiment behavior                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `disabled`       | `outcome: "skipped"` unless the opt-in env var is set                                                                                   |
| `skipped`        | `outcome: "skipped"` for missing credentials                                                                                            |
| `failed`         | `outcome: "inconclusive"` for rejected credentials, quota/rate limits, missing models, network errors, or unexpected provider responses |
| `ready`          | The experiment proceeds to setup, execute, and verify                                                                                   |

## Iteration 2 Suite

Second-wave business-scale experiments are defined in
`experiments/iteration-2/suite.manifest.json`. These runs must keep prior
experiment bundles immutable and write each attempt to a new directory under:

```text
experiments/iteration-2/results/<scenario-id>/<attempt-id>/
```

Each completed attempt should include `outcome.json`, `evidence-summary.json`,
`queue-metrics.json`, and `report.md`. Live LLM-backed scenarios still use the
same preflight gate above; missing credentials should skip the attempt rather
than producing partial evidence.

### Iteration 2 OpenClaw Live Reruns

The delayed-resume and concurrency scenarios have an additional explicit live
OpenClaw rerun gate. This prevents credentials alone from starting provider
calls and keeps CI deterministic.

```bash
PORTARIUM_LIVE_OPENCLAW_RERUNS=true \
PORTARIUM_EXPERIMENT_LIVE_LLM=true \
PORTARIUM_LIVE_MODEL_PROVIDER=openai \
OPENAI_API_KEY=... \
node experiments/iteration-2/scenarios/openclaw-concurrent-sessions/run.mjs \
  --results-dir experiments/iteration-2/results/openclaw-concurrent-sessions/live-openclaw-rerun-v1
```

Optionally restrict the live rerun to selected scenarios:

```bash
PORTARIUM_LIVE_OPENCLAW_SCENARIOS=growth-studio-openclaw-live-v2,openclaw-concurrent-sessions
```

Live OpenClaw rerun bundles add `live-rerun-metadata.json` and record redacted
provider/model/probe metadata, Approval IDs, queue metrics, Evidence Artifacts,
exact-once resume results, and the comparison with the deterministic bundle.
Provider failures, quota/rate limits, unavailable models, and unexpected model
responses are classified as provider variability or environment limitations,
not Portarium product defects.
