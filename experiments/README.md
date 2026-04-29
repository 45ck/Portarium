# Experiments

Live validation scripts that test Portarium's governance pipeline end-to-end.

## Purpose

This workspace provides a structured environment for running experiments against a live (or emulated) Portarium instance. Each experiment validates a specific hypothesis about system behaviour -- agent action governance, approval flows, policy enforcement, evidence integrity, etc.

## Core vs Future Work

Experiments validate hypotheses about the core governance loop. They are not
automatically product surface or release scope. A scenario becomes core only when
it proves that Portarium can safely govern agent Actions, approvals, policy,
evidence, or controlled execution in a way the release depends on. Business
showcases, media generation, Growth Studio, and other demos remain future work
unless they are promoted into specs and tested release gates.

## Directory structure

```
experiments/
  shared/              Shared utilities (setup helpers, assertion utilities, runner)
  template/            Copy this directory to create a new experiment
    hypothesis.md      What you expect to happen and why
    setup.md           Prerequisites, environment config, seed data
    run.mjs            The experiment script (executable with `node run.mjs`)
    results/           Output artefacts (logs, screenshots, JSON snapshots)
      .gitkeep
  <experiment-name>/   Each experiment lives in its own directory
  iteration-2/         Versioned suite contract for the second governed wave
```

## Creating an experiment

1. Copy `template/` to a new directory named after your experiment:

   ```bash
   cp -r experiments/template experiments/my-experiment
   ```

2. Fill in `hypothesis.md` with what you expect to observe.

3. Write `setup.md` describing prerequisites (running services, seed data, env vars).

4. Implement `run.mjs` using the shared experiment runner:

   ```ts
   import { runExperiment } from '../shared/experiment-runner.js';

   await runExperiment({
     name: 'my-experiment',
     setup: async (ctx) => {
       /* seed data, start services */
     },
     execute: async (ctx) => {
       /* trigger the behaviour under test */
     },
     verify: async (ctx) => {
       /* assert outcomes */
     },
     teardown: async (ctx) => {
       /* clean up */
     },
   });
   ```

5. Capture results in `results/` -- the runner writes a JSON summary automatically.

## Conventions

- Experiment names use kebab-case: `approval-timeout-recovery`, `tier-b-migration-rollback`.
- Each experiment must be independently runnable (`node experiments/<name>/run.mjs`).
- Do not import from `src/` directly -- use the Portarium SDK or HTTP API.
- Results in `results/` are gitignored except `.gitkeep`.
- Tag experiments with the bead that created them in `hypothesis.md`.
- Never overwrite a completed result bundle. For reruns or second attempts, use a
  new versioned attempt directory and compare it with the earlier run.

## Versioned Suites

Iteration 2 lives under `experiments/iteration-2/`. Its manifest defines the
required scenarios, metric names, immutable predecessor directories, and
append-only result layout. The scaffold is intentionally separate from the live
scenario implementations so dependent Beads can add each runnable experiment
without changing earlier evidence.

Use `experiments/shared/iteration2-telemetry.js` from Iteration 2 runners to
record queue depth, approval timing, resume latency, duplicate execution,
restart, and evidence completeness metrics. The helper writes
`queue-metrics.json`, `evidence-summary.json`, and a short `report.md` into the
attempt directory.

## Result capture format

The experiment runner writes `results/outcome.json` with:

```json
{
  "experiment": "my-experiment",
  "timestamp": "2026-03-30T12:00:00.000Z",
  "hypothesis": "...",
  "outcome": "confirmed" | "refuted" | "inconclusive" | "skipped",
  "duration_ms": 1234,
  "assertions": [
    { "label": "approval created", "passed": true },
    { "label": "agent unblocked after approval", "passed": true }
  ],
  "notes": "..."
}
```

## Live model preflight

Experiments that call real LLM providers must request the runner preflight:

```ts
await runExperiment({
  name: 'my-live-model-experiment',
  liveModelPreflight: true,
  execute: async (ctx) => {
    console.log(ctx.liveModelPreflight?.provider);
  },
  verify: async () => [],
});
```

The preflight is disabled unless `PORTARIUM_EXPERIMENT_LIVE_LLM=true` is set.
When disabled, or when the selected provider has no credential, the runner writes
`outcome: "skipped"` and does not call `setup`, `execute`, or `verify`.

Provider selection:

| Provider    | Select with                                | Credential env var                                  | Default model   |
| ----------- | ------------------------------------------ | --------------------------------------------------- | --------------- |
| OpenAI      | `PORTARIUM_LIVE_MODEL_PROVIDER=openai`     | `OPENAI_API_KEY`                                    | `gpt-4o`        |
| OpenRouter  | `PORTARIUM_LIVE_MODEL_PROVIDER=openrouter` | `OPENROUTER_API_KEY`                                | `openai/gpt-4o` |
| Codex route | `PORTARIUM_LIVE_MODEL_PROVIDER=codex`      | Codex CLI auth, or `CODEX_API_KEY`/`OPENAI_API_KEY` | `codex-cli`     |

If no provider is forced, the runner auto-detects from available credential env
vars in the order OpenAI, OpenRouter, Codex route. Override the model with
`PORTARIUM_LIVE_MODEL`, or provider-specific `OPENAI_MODEL`, `OPENROUTER_MODEL`,
or `CODEX_MODEL`.

The preflight performs one OpenAI-compatible `chat/completions` probe before the
experiment starts. When the Codex provider is forced and no API-key env var is
present, it instead performs a read-only `codex exec` probe using local Codex CLI
auth. The result bundle records provider, model, base URL or CLI route,
credential source, probe status, and any credential/quota/model availability
failure. It never writes credential values.
