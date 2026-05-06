# How-To: Run Cockpit Demos Locally

This guide covers running the Cockpit showcase demos on your local machine and exercising the integration showcase ladder (L0–L3).

## Prerequisites

- Node.js `>=22`
- Docker + Docker Compose
- `npm ci` completed at the repo root
- (Optional) `demo-machine` CLI for clip playback

---

## 1. Start the Cockpit dev server

```bash
cd apps/cockpit
npm run dev
```

Open `http://localhost:5173`. The Cockpit loads with in-memory mock handlers — no live backend required for L0 demos.

By default, demo mode uses the generic `platform-showcase` dataset. This is
Portarium control-plane snapshot data that exercises real Cockpit routes without
loading a customer-specific vertical prototype. Legacy vertical demo datasets
have been retired from Cockpit's active dataset registry.
Robotics demo surfaces are separately hidden unless
`VITE_PORTARIUM_ENABLE_ROBOTICS_DEMO=true`. Internal Engineering/Beads
surfaces are hidden from the default shell unless
`VITE_PORTARIUM_SHOW_INTERNAL_COCKPIT=true`. Advanced approval triage modes
such as briefing, graph, replay, and timeline are also hidden unless
`VITE_PORTARIUM_SHOW_ADVANCED_TRIAGE=true`.

Production Cockpit builds emit the generic `platform-showcase` mock asset only;
retired vertical chunks are not part of the production asset set.

---

## 2. Start Cockpit with live local data

For a live-data walkthrough, start and seed the full local stack first:

```bash
npm run dev:all
npm run dev:seed
npm run seed:cockpit-live:validate
```

Then run Cockpit against the control-plane API instead of the mock handlers:

```bash
VITE_PORTARIUM_API_BASE_URL=http://localhost:8080 VITE_PORTARIUM_ENABLE_MSW=false npm run cockpit:dev
```

Open `http://cockpit.localhost:1355`. The live seed uses workspace
`ws-local-dev`, pending approval `apr-live-001`, waiting run `run-live-001`,
and work item `wi-live-001`.

---

## 3. Run the demo-machine clips (L0 — mock data)

The `docs/internal/ui/cockpit/demo-machine/clips/` folder contains six deterministic storylines. Each clip is self-contained and uses the Cockpit mock handlers.

**Run a single clip:**

```bash
demo-machine run docs/internal/ui/cockpit/demo-machine/clips/01-approval-gate-unblocks-run.demo.yaml \
  --output ./output/cockpit-demo
```

**Available clips:**

| #   | File                                               | Story                                       |
| --- | -------------------------------------------------- | ------------------------------------------- |
| 01  | `01-approval-gate-unblocks-run.demo.yaml`          | Approval gate unblocks a stalled run        |
| 02  | `02-evidence-chain-update-on-decision.demo.yaml`   | Evidence chain updates on approval decision |
| 03  | `03-correlation-context-traversal.demo.yaml`       | Correlation/context traversal across runs   |
| 04  | `04-capability-matrix-connector-posture.demo.yaml` | Capability matrix connector posture         |
| 05  | `05-degraded-realtime-safety-ux.demo.yaml`         | Degraded real-time safety UX                |
| 06  | `06-agent-integration-quickstart.demo.yaml`        | Agent integration quickstart                |

---

## 4. Render showcase media (approvals-v2)

Generate a GIF and JSON artefact for the approvals-v2 showcase:

```bash
npm run cockpit:demo:approvals-v2:showcase
```

Outputs:

- `docs/internal/ui/cockpit/demo-machine/showcase/approvals-v2-approval-gate.gif`
- `docs/internal/ui/cockpit/demo-machine/showcase/approvals-v2-approval-gate.json`

---

## 5. Integration showcase ladder (L0–L3)

The integration showcase ladder progresses from mock data to a fully governed run. See [Integration Ladder](../integration/integration-ladder.md) for gate definitions.

### L0 — Mock data (no backend)

Browse any **Config → Adapters** page. All port families show mock data from `apps/cockpit/src/mocks/fixtures/`.

Run the adapter fixture tests:

```bash
npm run test -- src/infrastructure/adapters
```

### L1 — Live read (unit tests with recorded fixtures)

Run the concrete adapter tests for any family:

```bash
npm run test -- src/infrastructure/adapters/crm-sales
npm run test -- src/infrastructure/adapters/finance-accounting
```

### L2 — Bidirectional (round-trip demo)

Generate an adapter scaffold and run its tests:

```bash
npm run cli:portarium -- generate adapter \
  --name demo-crm-adapter \
  --provider-slug demo-crm \
  --port-family CrmSales \
  --output scaffolds/adapters/demo-crm

npm run test -- scaffolds/adapters/demo-crm/src/index.test.ts
```

### L3 — Governed run (local stack)

Start the full local stack (Postgres, Temporal, MinIO, Vault, API, worker):

```bash
npm run dev:all
npm run dev:seed
```

Run the governed-run smoke test against the live stack:

```bash
GOVERNED_RUN_INTEGRATION=true LOCAL_STACK_URL=http://localhost:8080 \
  npm run test -- src/infrastructure/adapters/governed-run-smoke.test.ts
```

Or run the full smoke pipeline (boots stack, seeds, then runs integration smoke):

```bash
npm run smoke:stack
```

For the run-emulator unit tests (no live stack required):

```bash
npm run test -- src/infrastructure/emulator/run-emulator.test.ts
```

---

## 6. Verify evidence after a governed run

```bash
npm run cli:portarium -- evidence verify --run-id <runId>
```

Or view evidence in the Cockpit under **Evidence**.

---

## Related

- [Integration Ladder](../integration/integration-ladder.md)
- [Integration Demo Walkthrough](../integration/demo-walkthrough.md)
- [Local Development Guide](../getting-started/local-dev.md)
- [Evidence Trace](./evidence-trace.md)
