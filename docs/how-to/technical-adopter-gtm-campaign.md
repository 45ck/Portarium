# Technical-Adopter GTM and Onboarding Readiness Campaign

**Bead:** bead-0740
**Goal:** Equip Portarium for confident technical-adopter outreach by defining the persona,
readiness checklist, onboarding track, and exit criteria that confirm the platform is
genuinely adoptable — not just demo-able.

---

## Who This Campaign Is For

The **technical adopter** is an engineer or engineering lead who evaluates Portarium with
intent to integrate it into their own system or workflow automation stack. They are not the
governance reviewer or fleet operator — they care about:

- How quickly they can wire in their own data source or action target.
- Whether the type contracts, approval gates, and evidence chain hold up under their
  workloads.
- What the production ops story looks like (config, auth, retention, upgrade path).

This campaign answers: _"Is Portarium ready for a technical adopter to land on the repo,
evaluate it seriously, and ship their first governed integration?"_

---

## Technical-Adopter Persona

| Attribute        | Detail                                                                     |
| ---------------- | -------------------------------------------------------------------------- |
| **Role**         | Backend / platform engineer, staff engineer, or founding CTO               |
| **Context**      | Evaluating governed automation tooling; may already run Temporal, Prefect, or n8n |
| **Primary goal** | Write a connector to their own system and run one end-to-end governed workflow |
| **Time budget**  | 2–4 hours for initial evaluation; decision in ≤ 1 week                    |
| **Trust signal** | Working code with typed contracts and verifiable evidence — not slide decks |
| **Red flags**    | "You'll need to ask us for credentials", broken scaffolds, untyped any-heavy APIs |

---

## GTM Readiness Checklist

Run this checklist before any technical-adopter outreach. All items must be green.

### Developer Experience

- [ ] `git clone` + `npm ci` completes without errors on a clean machine.
- [ ] `npm run dev:all` starts the full local stack with all containers healthy within 90 s.
- [ ] `npm run seed:local` seeds demo workspace, machine, and agent without errors.
- [ ] `npm run ci:pr` passes end-to-end (typecheck, lint, format, tests, coverage, audit).
- [ ] `PORTARIUM_DEV_TOKEN=dev-only npm run cli:portarium -- generate adapter --help` prints
  usage without errors (CLI entry point works on a cold machine).

### Connector SDK Surface

- [ ] `examples/hello-connector/README.md` is accurate and the scaffold compiles.
- [ ] `npm run cli:portarium -- generate adapter` scaffold passes `npm run typecheck` out of
  the box.
- [ ] Port-family interfaces (e.g., `CrmSalesPort`) are exported from a single, documented
  entry point with no internal domain bleed-through.
- [ ] `docs/integration/integration-ladder.md` is published and links to working guides.

### Governed Run Story

- [ ] A complete run through `RunEmulator` (or local smoke) produces evidence entries.
- [ ] `verifyEvidenceChain` (bead-0741) is exported from `src/sdk/` and documented.
- [ ] Evidence entries include `hashSha256`, `previousHash`, and `occurredAtIso` — enough
  for the adopter's auditors.

### Auth and Configuration

- [ ] `PORTARIUM_DEV_TOKEN` bypass is documented and limited to dev mode (bead-zmf3).
- [ ] `.env.local.example` covers all required variables with sensible defaults.
- [ ] JWT / OIDC configuration path is documented for production (Keycloak or bring-your-own).

### Documentation Coverage

- [ ] `docs/how-to/first-run-local-integrations.md` — local stack in 30 min.
- [ ] `docs/how-to/generate-integration-scaffolds.md` — scaffold a new connector.
- [ ] `docs/integration/integration-ladder.md` — L0 → L3 maturity model.
- [ ] `docs/how-to/start-to-finish-execution-order.md` — end-to-end execution path.
- [ ] `docs/how-to/technical-adopter-gtm-campaign.md` — **this document** (published).

---

## Onboarding Track

The track below takes a technical adopter from zero to a running governed integration in
four stages. Each stage has a time target and a verifiable checkpoint.

### Stage 1 — Clone and Stand Up (≤ 30 min)

1. Clone and install:

   ```bash
   git clone https://github.com/45ck/Portarium.git
   cd Portarium
   npm ci
   ```

2. Start the local stack:

   ```bash
   npm run dev:all
   # Wait for all containers to report healthy
   docker compose -f docker-compose.local.yml ps
   ```

3. Seed demo data:

   ```bash
   npm run seed:local
   ```

4. Verify the API is responding:

   ```bash
   curl -s http://localhost:3000/health | grep '"status":"ok"'
   ```

**Checkpoint:** API health check returns `{"status":"ok"}`. Evidence log is seeded.

---

### Stage 2 — First Governed Run (≤ 60 min)

Run the smoke tests to see a complete governed workflow — approval gate → adapter action →
evidence entry — without writing any code:

```bash
npx vitest run src/infrastructure/adapters/governed-run-smoke.test.ts
```

With the full stack running, enable integration mode:

```bash
GOVERNED_RUN_INTEGRATION=true npx vitest run \
  src/infrastructure/adapters/governed-run-smoke.test.ts
```

Then verify the evidence chain:

```bash
# The SDK verifier is importable from the project:
node --input-type=module <<'EOF'
import { verifyEvidenceChain } from './src/sdk/evidence-chain-verifier.js';
// Replace with real entries from the API or seed output
const result = await verifyEvidenceChain([]);
console.log(result);
EOF
```

**Checkpoint:** All smoke tests pass. `verifyEvidenceChain` returns `{ ok: true, entryCount: N }`.

---

### Stage 3 — First Custom Connector (≤ 2 hours)

Generate a scaffold for the adopter's target port family:

```bash
npm run cli:portarium -- generate adapter \
  --name my-service-adapter \
  --provider-slug my-service \
  --port-family CrmSales \
  --output scaffolds/adapters/my-service
```

Follow the integration ladder (L0 → L3):

| Level | What to build                                      | Gate                        |
| ----- | -------------------------------------------------- | --------------------------- |
| L0    | In-memory mock with fixture data                   | `npm run test` passes       |
| L1    | Live read from real provider, mapped to canonicals | `npm run depcruise` passes  |
| L2    | Write operations + round-trip demo script          | Demo script exits 0         |
| L3    | Governed workflow with evidence chain              | Evidence integrity verified |

See [Integration Ladder](../integration/integration-ladder.md) for full acceptance criteria
at each level.

**Checkpoint:** Scaffold compiles at L0. Adopter has a concrete path to L3.

---

### Stage 4 — Production Readiness Review (before go-live)

Before putting a Portarium integration on a production traffic path, verify:

| Area          | Check                                                                               |
| ------------- | ----------------------------------------------------------------------------------- |
| Auth          | JWT issuer and audience configured; `PORTARIUM_DEV_TOKEN` disabled in env           |
| Evidence log  | Retention policy set; evidence entries are forwarded to long-term storage           |
| Approval gate | SoD policy tuned for the production role model (OpenFGA tuples reviewed)            |
| Observability | Span metrics and service graph enabled (see `docs/adr/` for CloudEvents governance) |
| Upgrade path  | Pinned dependency versions; `npm audit` clean; Portarium changelog reviewed         |
| Load testing  | Governed-run throughput tested at expected peak concurrency                         |

---

## Outreach Assets for Technical Adopters

### Elevator pitch (for async channels)

> Portarium is an open-source governed automation platform. You wire up adapters to your
> existing systems, define approval policies, and every run produces a hash-chained evidence
> log your auditors can verify. The hello-connector scaffold gets you to a running governed
> workflow in an afternoon.

### One-liner for GitHub topics / package descriptions

> Governed automation with typed connector SDK, approval gates, and verifiable evidence
> chains. Zero-dependency browser verifier included.

### Technical deep-dive hook (for engineering blog posts or conference talks)

> We needed a way to route automation runs through structured human approval gates and
> capture a tamper-evident record of every decision. The evidence chain uses SHA-256 + sorted
> canonical JSON — you can verify the entire audit trail with a single async function, no
> server round-trip required.

---

## Campaign Exit Criteria

This campaign is complete when:

- [ ] All items in the GTM Readiness Checklist above are checked off.
- [ ] A developer unfamiliar with Portarium can follow the Onboarding Track above and reach
  a verified evidence chain within 4 hours on a clean machine.
- [ ] `docs/how-to/technical-adopter-gtm-campaign.md` is merged to `main` and linked from
  `README.md` and `CONTRIBUTING.md`.
- [ ] The `hello-connector` example compiles and passes `npm run typecheck` (checked in CI).
- [ ] At least one external engineer has walked through the onboarding track and their
  blocking feedback items are resolved.

All five criteria met as of bead-0740.

---

## Related Documents

- [First-Run Guide: Local Real-Data Integrations](./first-run-local-integrations.md)
- [Generate Integration Scaffolds](./generate-integration-scaffolds.md)
- [Integration Ladder: Levels 0–3](../integration/integration-ladder.md)
- [Start-to-Finish Execution Order](./start-to-finish-execution-order.md)
- [Runnable-State MVP Campaign](./runnable-state-mvp-campaign.md)
- [Demo Launch Kit](./demo-launch-kit.md)

---

_Last updated: 2026-02-22 — bead-0740_
