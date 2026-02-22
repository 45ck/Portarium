# Integration Demo Walkthrough

A step-by-step guide to running the Portarium integration showcase locally and demonstrating the full governance flow.

## Prerequisites

- Node.js `>=22`
- Docker + Docker Compose
- `PORTARIUM_DEV_TOKEN` set (see [Local Dev Guide](../getting-started/local-dev.md))

## 1. Start the local stack

```bash
docker compose up -d
npm run migrate:ci
```

## 2. Boot the control plane

```bash
PORTARIUM_DEV_TOKEN=demo-secret npx tsx src/presentation/runtime/control-plane.ts
```

In a second terminal, boot the execution plane:

```bash
PORTARIUM_ENABLE_TEMPORAL_WORKER=true \
PORTARIUM_DEV_TOKEN=demo-secret \
npx tsx src/presentation/runtime/worker.ts
```

## 3. Start the Cockpit

```bash
cd apps/cockpit && npm run dev
```

Open `http://localhost:5173`.

## 4. Showcase: Approvals governance flow

The approvals flow exercises the full approval-gate path with evidence chain:

```bash
npm run cockpit:demo:approvals-v2:showcase
```

This opens a headed Chromium browser, walks through:
1. Start a workflow run with an approval gate.
2. Submit the approval.
3. View the resulting evidence chain.

Artefacts are written to `docs/ui/cockpit/demo-machine/showcase/`.

## 5. Showcase: Integration ladder levels

### Level 0 — Mock data

The Cockpit ships with in-memory mock handlers for all port families. Navigate to any Config → Adapters page to see L0 mock data.

### Level 1 — Live read demo (CRM Sales example)

The in-memory CRM adapter (`InMemoryCrmSalesAdapter`) demonstrates the canonical `Party`, `Opportunity`, and `Order` shapes. Run the unit tests to verify:

```bash
npm run test -- src/infrastructure/adapters/crm-sales
```

### Level 2 — Bidirectional demo

Generate an adapter scaffold and run the round-trip demo:

```bash
npm run cli:portarium -- generate adapter \
  --name demo-crm-adapter \
  --provider-slug demo-crm \
  --port-family CrmSales \
  --output scaffolds/adapters/demo-crm
```

Then run the scaffold's generated tests:

```bash
npm run test -- scaffolds/adapters/demo-crm/src/index.test.ts
```

### Level 3 — Governed run

The `RunEmulator` exercises the full governance stack without live infrastructure:

```bash
npm run test -- src/infrastructure/emulator/run-emulator.test.ts
```

To run against the live stack (requires Docker + control plane running):

```bash
PORTARIUM_DEV_TOKEN=demo-secret node scripts/qa/smoke-test-local.mjs
```

## 6. Verify evidence

After any governed run, evidence is visible in the Cockpit under **Evidence** and verifiable via the CLI:

```bash
npm run cli:portarium -- evidence verify --run-id <runId>
```

## Next steps

- See the [Integration Ladder](./integration-ladder.md) for level definitions and gates.
- See [How-To: Generate Integration Scaffolds](../how-to/generate-integration-scaffolds.md) to build your own adapter.
- See [Evidence Trace](../how-to/evidence-trace.md) for evidence chain details.
