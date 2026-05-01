# Run Approval Evaluations

These evaluations prove the approval loop without requiring hosted services or
live LLM keys by default. They are safe for OSS contributors and CI because the
deterministic path uses local test doubles, redacted artifacts, and fixed
scenario assertions.

## Deterministic Path

Run the full deterministic scenario gate:

```bash
npm run test:scenarios
```

For a shorter approval-focused pass, run these artifacts directly:

```bash
node node_modules/vitest/vitest.mjs run scripts/integration/scenario-core-governance-eval.test.ts
node node_modules/vitest/vitest.mjs run scripts/integration/scenario-approval-execute-lifecycle.test.ts
node node_modules/vitest/vitest.mjs run src/application/commands/execute-approved-agent-action.test.ts
node node_modules/vitest/vitest.mjs run src/presentation/runtime/control-plane-handler.agent-action-execute.contract.test.ts
```

These cover:

| Artifact                                                             | What it proves                                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `scenario-core-governance-eval.test.ts`                              | safe action allow, governed action routing, event stream, approval, resume    |
| `scenario-approval-execute-lifecycle.test.ts`                        | approve-then-execute, double-execute rejection, denied approval rejection     |
| `execute-approved-agent-action.test.ts`                              | concurrent execute, active reservation retry, crash-after-dispatch recovery   |
| `control-plane-handler.agent-action-execute.contract.test.ts`        | HTTP execute contract, including `Executing` replay and response shape        |
| `experiments/iteration-2/scenarios/governed-resume-recovery/run.mjs` | pending Approval Gate recovery and exactly-once governed resume result bundle |

When you need the Iteration 2 resume result bundle, run:

```bash
node experiments/iteration-2/scenarios/governed-resume-recovery/run.mjs
```

The result artifacts are append-only under:

```text
experiments/iteration-2/results/governed-resume-recovery/<attempt-id>/
```

Expected files are `outcome.json`, `evidence-summary.json`,
`queue-metrics.json`, and `report.md`.

## Optional Live LLM Path

Live LLM approval evaluations are disabled by default. Only use them when you
are intentionally testing provider-backed proposal text or agent planning. The
live path must use `experiments/shared/experiment-runner.js` with
`liveModelPreflight: true` so missing keys skip before setup and provider errors
produce inconclusive results rather than partial evidence.

Minimal runner shape:

```js
import { runExperiment } from '../shared/experiment-runner.js';

await runExperiment({
  name: 'live-approval-loop',
  liveModelPreflight: true,
  async execute(ctx) {
    const provider = ctx.liveModelPreflight?.provider;
    // Run provider-backed proposal -> approval -> execute/reject here.
    ctx.state.provider = provider;
  },
  async verify() {
    return [];
  },
});
```

Run with an explicit opt-in and provider:

```bash
PORTARIUM_EXPERIMENT_LIVE_LLM=true \
PORTARIUM_LIVE_MODEL_PROVIDER=openai \
OPENAI_API_KEY=... \
node experiments/<your-live-approval-eval>/run.mjs
```

Supported provider selectors are documented in
[Run Live Model Experiments](run-live-model-experiments.md).

## Safety Boundary

- Do not store prompts that contain secrets, credentials, customer data, or
  proprietary source text.
- Do not write credential values to logs, `outcome.json`, reports, screenshots,
  or traces.
- Record only provider, model, credential source name, base URL or CLI route,
  probe kind, HTTP status, failure kind, and redacted run metadata.
- Keep CI deterministic: live provider calls require
  `PORTARIUM_EXPERIMENT_LIVE_LLM=true` or `PORTARIUM_LIVE_MODEL_RUNS=true`.
- Approval evaluations must prove both approval and rejection paths; successful
  live approval evidence is not enough by itself.
- For crash-after-dispatch or active `Executing` recovery, rely on deterministic
  tests. Do not inject real provider failures into shared accounts.
