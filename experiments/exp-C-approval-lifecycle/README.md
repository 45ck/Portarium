# Experiment C: approval lifecycle via Cockpit script

This experiment validates an operator-visible approval lifecycle for a governed
`write:file` action without requiring a live browser or real LLM in CI.

The deterministic path starts a local Cockpit/control-plane-compatible surface
and drives the native OpenClaw plugin contract:

1. Agent proposes `write:file` with `POST /v1/workspaces/:workspaceId/agent-actions:propose`.
2. The action becomes visible in `GET /v1/workspaces/:workspaceId/approvals?status=pending`.
3. The operator approves with `POST /v1/workspaces/:workspaceId/approvals/:approvalId/decision`.
4. The agent polls approval status and executes via
   `POST /v1/workspaces/:workspaceId/agent-actions/:approvalId/execute`.
5. The script verifies approval, run, and evidence visibility through Cockpit-style query surfaces.

## Run

```bash
node experiments/exp-C-approval-lifecycle/run.mjs
```

The script writes `experiments/exp-C-approval-lifecycle/results/outcome.json`.

## Targeted Test

```bash
node node_modules/vitest/vitest.mjs run scripts/integration/scenario-exp-c-approval-lifecycle.test.ts
```

## Live Cockpit Step

The live/browser step is intentionally opt-in because CI should not depend on a
running Cockpit dev server. For manual validation:

```bash
npm run cockpit:dev
npm run ab -- open http://cockpit.localhost:1355 --headed
```

Use the same lifecycle stages from `outcome.json` to inspect equivalent
Approvals, Runs, and Evidence views in a seeded or live stack.
