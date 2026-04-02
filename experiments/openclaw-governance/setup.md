# Setup

## Prerequisites

### 1. Portarium demo server

The experiment requires a Portarium control plane server running locally.

```bash
# From repo root — starts the HTTP control plane on port 3000
npm run dev
```

Verify it is healthy:

```bash
curl http://localhost:3000/health
# → { "status": "ok" }
```

### 2. Environment variables

Export the following before running the experiment:

| Variable                 | Default                 | Purpose                                 |
| ------------------------ | ----------------------- | --------------------------------------- |
| `PORTARIUM_URL`          | `http://localhost:3000` | Base URL of the Portarium control plane |
| `PORTARIUM_WORKSPACE_ID` | `ws-experiment`         | Workspace to create the proposal in     |
| `PORTARIUM_BEARER_TOKEN` | `dev-token`             | Bearer token accepted by the dev server |
| `PORTARIUM_TENANT_ID`    | `default`               | Tenant header value                     |

```bash
export PORTARIUM_URL=http://localhost:3000
export PORTARIUM_WORKSPACE_ID=ws-experiment
export PORTARIUM_BEARER_TOKEN=dev-token
export PORTARIUM_TENANT_ID=default
```

### 3. Capability registry (optional)

For `send_email` to route to `HumanApprove`, the workspace capability registry must not have an
explicit `Auto` entry for `send_email`. The default policy (unknown capability → HumanApprove) is
sufficient for the experiment.

## Running the experiment

```bash
node experiments/openclaw-governance/run.mjs
```

A `results/outcome.json` file is written with the full assertion log.

## What is NOT required

- An OpenClaw installation — the experiment calls the Portarium HTTP API directly using the same
  client code as the plugin, bypassing the OpenClaw runtime entirely.
- An LLM API key — no model inference happens during this experiment.
