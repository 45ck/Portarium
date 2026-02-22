# Integration Ladder: Levels 0–3

This document defines the four maturity levels for Portarium integrations and the gates required to move between them.

## Overview

The integration ladder provides a structured progression from a stub through to a production-grade governed integration. Each level has explicit acceptance criteria, so teams and the CI pipeline can agree on when a level is "complete."

```
L0 (Mock) → L1 (Live Read) → L2 (Bidirectional) → L3 (Governed)
```

---

## Level 0 — In-Memory Mock

**Goal:** Demonstrate the Portarium canonical shape for a port family with deterministic test data.

**What is present:**

- An in-memory adapter implementing the port-family interface (e.g. `InMemoryCrmSalesAdapter`).
- A fixture file under `src/infrastructure/adapters/<family>/` with representative `MOCK_*` arrays.
- Unit tests verifying list / get operations return fixture data.

**Acceptance:**

- [ ] Adapter class is named `InMemory<Family>Adapter` and lives in `src/infrastructure/adapters/<port-family-slug>/`.
- [ ] All port-family operations return shaped canonical objects (not `any`).
- [ ] Tests pass with `npm run test`.
- [ ] `npm run typecheck` is clean.

**Example adapters:** every `in-memory-*-adapter.ts` in `src/infrastructure/adapters/`.

---

## Level 1 — Live Provider Read

**Goal:** Fetch real data from a third-party provider and map it into Portarium canonical objects.

**What is present:**

- A concrete adapter (e.g. `HubSpotCrmSalesAdapter`) that calls the provider API.
- Mapping functions from provider payloads to canonical types.
- Contract / integration tests using recorded HTTP fixtures or MSW handlers.
- `.env.example` documenting required credentials.

**Acceptance:**

- [ ] Concrete adapter passes CI in `--run` mode (no live network calls required, recorded fixtures accepted).
- [ ] Mapping covers the required canonical fields for the port family.
- [ ] `npm run depcruise` passes (no layer violations).
- [ ] Adapter is listed in `docs/governance/domain-coverage-matrix.json` under `coverageBeads`.

---

## Level 2 — Bidirectional (Hello-Connector)

**Goal:** The adapter can both read from and write to the provider, and a complete demo workflow runs end-to-end in the Cockpit.

**What is present:**

- Scaffold generated via `npm run cli:portarium -- generate adapter ...` (see [how-to guide](../how-to/generate-integration-scaffolds.md)).
- Write operations (create / update / delete) implemented and tested.
- A demo script under `scripts/qa/` that exercises the full round-trip.
- Cockpit mock-handler for the family is wired in `apps/cockpit/src/mocks/handlers.ts`.

**Acceptance:**

- [ ] All port-family write operations return shaped canonical objects.
- [ ] Demo script runs to completion with `PORTARIUM_DEV_TOKEN=<token>` and local stack.
- [ ] Page-load test in `apps/cockpit/src/routes/page-load.test.tsx` covers the family's Cockpit route (if one exists).
- [ ] Coverage scorecard shows ≥ 2/4 criteria green.

---

## Level 3 — Full Governed Workflow

**Goal:** A production-quality governed run exercises the adapter through approval gates, SoD checks, evidence generation, and retention.

**What is present:**

- The adapter is referenced in at least one workflow definition in `.specify/specs/`.
- A governed-run test (via `RunEmulator` or a live local stack smoke test) demonstrates: start workflow → approval gate → adapter action → evidence entry.
- Evidence chain passes `integrity` verification.
- The integration appears in the domain-coverage-matrix with `coverageStatus: "covered"`.

**Acceptance:**

- [ ] `RunEmulator` scenario or live smoke test passes end-to-end.
- [ ] Evidence `integrity` check passes.
- [ ] `docs/governance/domain-coverage-matrix.json` entry has `coverageStatus: "covered"` and no open `gapBeads`.
- [ ] ADR or closeout review exists under `docs/review/`.

---

## Gate progression checklist

| Gate                               | L0→L1    | L1→L2    | L2→L3    |
| ---------------------------------- | -------- | -------- | -------- |
| In-memory adapter + tests          | Required | —        | —        |
| Live read + mapped canonicals      | Required | —        | —        |
| Write operations + round-trip demo | —        | Required | —        |
| Governed-run evidence chain        | —        | —        | Required |
| Coverage matrix updated            | —        | Required | Required |
| `npm run ci:pr` passes             | Always   | Always   | Always   |

---

## Quick start for a new integration

1. **Generate scaffold**

   ```bash
   npm run cli:portarium -- generate adapter \
     --name my-provider-adapter \
     --provider-slug my-provider \
     --port-family CrmSales \
     --output scaffolds/adapters/my-provider
   ```

2. **Implement the in-memory mock (L0)**

   Copy an existing `in-memory-*-adapter.ts` for the same port family and wire your fixture data.

3. **Wire the provider client (L1)**

   Replace stubs in `src/index.ts` with real HTTP calls and add mapping functions.

4. **Add write operations (L2)**

   Implement the mutating port operations and add a demo script to `scripts/qa/`.

5. **Wire a governed workflow (L3)**

   Add a `.specify/specs/` workflow that includes your adapter action and runs through `RunEmulator` or the local dev stack.

---

## Related resources

- [How-To: Generate Integration Scaffolds](../how-to/generate-integration-scaffolds.md)
- [Domain Coverage Matrix](../governance/domain-coverage-matrix.json)
- [Local Development Guide](../getting-started/local-dev.md)
- [Evidence Trace How-To](../how-to/evidence-trace.md)
