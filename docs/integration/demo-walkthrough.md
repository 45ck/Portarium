# Integration Demo Walkthrough

A step-by-step guide to running the Portarium integration showcase locally and demonstrating the full governance flow.

## Prerequisites

- Node.js `>=22`
- Docker + Docker Compose
- Local dev auth enabled with `ENABLE_DEV_AUTH=true`, `PORTARIUM_DEV_TOKEN`, and `PORTARIUM_DEV_WORKSPACE_ID` (see [Local Dev Guide](../getting-started/local-dev.md))

## 1. Start the local stack

```bash
npm run dev:all
npm run dev:seed
npm run seed:cockpit-live:validate
```

This starts the hardcoded local stack profiles, including Postgres, Temporal,
MinIO, Vault, Keycloak, OpenFGA, Odoo, tools services, the API on port 8080,
and the worker. `dev:all` also runs evidence-store, OpenFGA, and DB init
scripts. `npm run dev:seed` seeds `ws-local-dev` with live Cockpit data: runs,
approvals, work items, evidence, config, and workforce records. The API is
available at `http://localhost:8080`.

> **Dev-auth bypass:** `PORTARIUM_DEV_TOKEN=portarium-dev-token` is accepted as a static bearer
> token only when `ENABLE_DEV_AUTH=true` and `NODE_ENV` is `development` or `test`.
> No Keycloak required for demos.

## 2. Boot the Cockpit against live data

```bash
VITE_PORTARIUM_API_BASE_URL=http://localhost:8080 VITE_PORTARIUM_ENABLE_MSW=false npm run cockpit:dev
```

Open `http://cockpit.localhost:1355`.

Use these seeded IDs for a live walkthrough:

| Surface   | Seeded ID         | What to show                         |
| --------- | ----------------- | ------------------------------------ |
| Run       | `run-live-001`    | Waiting-for-approval run state       |
| Approval  | `apr-live-001`    | Pending approval that can be decided |
| Work item | `wi-live-001`     | Linked human task and approval       |
| Evidence  | `ev-live-001`     | Plan evidence chain entry            |
| Config    | `adapter-iam-001` | Live adapter registration record     |

## 3. Showcase: Approvals governance flow

The approvals flow exercises the full approval-gate path with evidence chain:

```bash
npm run cockpit:demo:approvals-v2:showcase
```

This opens a headed Chromium browser, walks through:

1. Start a workflow run with an approval gate.
2. Submit the approval.
3. View the resulting evidence chain.

Artefacts are written to `docs/internal/ui/cockpit/demo-machine/showcase/`.

## 4. Showcase: Integration ladder levels

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

To run against the live stack (requires `npm run dev:all`, `npm run dev:seed`, and `npm run seed:cockpit-live:validate`):

```bash
GOVERNED_RUN_INTEGRATION=true LOCAL_STACK_URL=http://localhost:8080 \
  npm run test -- src/infrastructure/adapters/governed-run-smoke.test.ts
```

Or boot the full pipeline in one command:

```bash
npm run smoke:stack
```

## 5. Verify evidence

After any governed run, evidence is visible in the Cockpit under **Evidence** and verifiable via the CLI:

```bash
npm run cli:portarium -- evidence verify --run-id <runId>
```

## Next steps

- See the [Integration Ladder](./integration-ladder.md) for level definitions and gates.
- See [How-To: Generate Integration Scaffolds](../how-to/generate-integration-scaffolds.md) to build your own adapter.
- See [Evidence Trace](../how-to/evidence-trace.md) for evidence chain details.
