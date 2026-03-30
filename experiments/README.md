# Experiments

Live validation scripts that test Portarium's governance pipeline end-to-end.

## Purpose

This workspace provides a structured environment for running experiments against a live (or emulated) Portarium instance. Each experiment validates a specific hypothesis about system behaviour -- agent action governance, approval flows, policy enforcement, evidence integrity, etc.

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

## Result capture format

The experiment runner writes `results/outcome.json` with:

```json
{
  "experiment": "my-experiment",
  "timestamp": "2026-03-30T12:00:00.000Z",
  "hypothesis": "...",
  "outcome": "confirmed" | "refuted" | "inconclusive",
  "duration_ms": 1234,
  "assertions": [
    { "label": "approval created", "passed": true },
    { "label": "agent unblocked after approval", "passed": true }
  ],
  "notes": "..."
}
```
