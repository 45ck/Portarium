# Hello Portarium — Quickstart Guide

Get a running Portarium instance locally in under 30 minutes.

## Prerequisites

- **Node.js** ≥ 20 (`node --version`)
- **Docker Compose** ≥ 2.x (`docker compose version`)
- **Git** ≥ 2.x

## Step 1 — Clone and install

```bash
git clone https://github.com/your-org/portarium.git
cd portarium
npm install
```

## Step 2 — Start the local stack

```bash
docker compose up -d          # starts Postgres, OpenFGA, NATS, MinIO
npm run dev                   # starts the execution-plane control-plane HTTP server
```

The server starts on `http://localhost:3000`. Verify with:

```bash
curl http://localhost:3000/health
# → {"status":"ok"}
```

## Step 3 — Run your first workflow

The seed script provisions a demo workspace and a sample workflow definition:

```bash
npm run db:seed
```

Trigger a workflow run via the SDK:

```typescript
import { PortariumClient } from './src/sdk/portarium-client.ts';

const client = new PortariumClient({ baseUrl: 'http://localhost:3000', apiKey: 'dev-key' });
const run = await client.runs.start({
  workflowId: 'hello-workflow',
  workspaceId: 'workspace-default',
});
console.log('Run started:', run.runId);
```

Watch the run progress in the Cockpit UI at `http://localhost:5173` (start with `npm run cockpit:dev`).

## Step 4 — Inspect the evidence chain

Every governed run produces a hash-chained evidence log. Verify yours:

```bash
npm run sdk:verify -- --runId <run-id> --workspaceId workspace-default
```

## What's next?

You've completed **L0 (Discovery)** on the [Adoption Ladder](../adoption/adoption-ladder.md).

To advance to **L1 (Integration Spike)**, connect a vertical pack in your own staging environment:
see [Adoption Readiness Checklist](../adoption/adoption-readiness-checklist.md).

## Troubleshooting

| Error                                   | Fix                                                      |
| --------------------------------------- | -------------------------------------------------------- |
| `docker compose up` fails — port in use | Change `POSTGRES_PORT` in `.env.local`                   |
| `npm install` fails with peer deps      | Use `npm install --legacy-peer-deps`                     |
| `health` returns 503                    | Wait for Postgres migrations: `npm run migrate:apply:ci` |
