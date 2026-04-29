# Run Live Model Experiments

Live model experiments are opt-in and must use the shared experiment runner
preflight. Normal CI does not need API keys and does not make provider calls.

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

Supported provider selectors:

| Selector     | Credential source                                   | Optional model override                      |
| ------------ | --------------------------------------------------- | -------------------------------------------- |
| `openai`     | `OPENAI_API_KEY`                                    | `PORTARIUM_LIVE_MODEL` or `OPENAI_MODEL`     |
| `openrouter` | `OPENROUTER_API_KEY`                                | `PORTARIUM_LIVE_MODEL` or `OPENROUTER_MODEL` |
| `codex`      | Codex CLI auth, or `CODEX_API_KEY`/`OPENAI_API_KEY` | `PORTARIUM_LIVE_MODEL` or `CODEX_MODEL`      |

If `PORTARIUM_LIVE_MODEL_PROVIDER` is omitted, the runner detects a provider from
the available credential env vars. If no credential is present, the experiment is
skipped before setup or execution.

The result bundle records the provider, model, credential env var name, base URL,
probe endpoint kind, HTTP status, and failure kind. Credential values are never
written to `results/outcome.json`.

For the Codex route without API-key env vars, the preflight runs a read-only
`codex exec` probe and records `credentialSource: { kind: "cli", name: "codex" }`
when local Codex auth is available.

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
