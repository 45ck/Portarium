# Hello Portarium — Quickstart Guide

Run Portarium locally in under 30 minutes and validate a governed flow path.

## Prerequisites

- **Node.js** ≥ 22 (`node --version`)
- **Docker Compose** ≥ 2.x (`docker compose version`)
- **Git** ≥ 2.x

## Step 1 — Clone and install

```bash
git clone https://github.com/45ck/Portarium.git
cd Portarium
npm ci
```

## Step 2 — Start the local stack

```bash
npm run dev:all
npm run dev:seed
```

Verify the control plane health endpoint:

```bash
curl -s http://localhost:8080/healthz
# {"status":"ok"}
```

## Step 3 — Run one governed flow

Run the built-in smoke scenario that exercises workspace setup, approval gating,
adapter action dispatch, and evidence chain checks:

```bash
npm run smoke:governed-run
```

For a guided API tutorial path, continue with
`docs/tutorials/hello-governed-workflow.md`.

## Step 4 — Inspect the evidence chain

Review the smoke output for:

- workspace creation
- approval decision
- adapter action dispatch
- evidence chain validation

## What's next?

You have completed **L0 (Discovery)** on the
[Adoption Ladder](../adoption/adoption-ladder.md).

Next:

1. `docs/getting-started/local-dev.md`
2. `docs/tutorials/hello-governed-workflow.md`
3. `docs/explanation/architecture.md`
4. `docs/spec/openapi/portarium-control-plane.v1.yaml`

## Troubleshooting

| Error                              | Fix                                                                 |
| ---------------------------------- | ------------------------------------------------------------------- |
| `npm run dev:all` fails            | Check Docker services with `docker compose ps` and fix port clashes |
| `healthz` returns non-200          | Wait for stack startup to complete, then re-run `npm run dev:seed`  |
| `npm run smoke:governed-run` fails | Re-run `npm run test` to confirm local test/runtime prerequisites   |
