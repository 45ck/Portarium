# Runnable-State MVP Campaign

**Bead:** bead-0739
**Goal:** Define the checklist and execution path that takes Portarium from a passing
test suite to a live, end-to-end governed workflow run against real or local-stub data.

---

## What "Runnable-State MVP" Means

A release is considered _runnable-state_ when an engineer can, on a clean machine:

1. Clone the repo and install dependencies.
2. Run `npm run seed:local` to bootstrap a demo workspace, machine, and agent.
3. Trigger a governed workflow run (via HTTP or CLI) that passes through:
   - Authorization gate (OpenFGA or stub `ALLOW_ALL`)
   - Approval gate (human-in-the-loop or auto-approved by policy tier)
   - Adapter action (Odoo or any registered adapter)
   - Machine action (OpenClaw or local stub runner)
   - Evidence chain (tamper-evident hash chain persisted in the evidence log)
4. Observe evidence entries that prove each step ran and was recorded.

---

## Integration-Complete Checklist

| #   | Gate                                         | Artefact                                                             | Status |
| --- | -------------------------------------------- | -------------------------------------------------------------------- | ------ |
| 1   | Seed script runs end-to-end                  | `npm run seed:local` (bead-0733)                                     | ✅     |
| 2   | Governed-run smoke test passes               | `src/infrastructure/adapters/governed-run-smoke.test.ts` (bead-0736) | ✅     |
| 3   | CI runnable-state smoke passes               | `.github/workflows/runnable-state-smoke.yml` (bead-0737)             | ✅     |
| 4   | First-run guide published                    | `docs/how-to/first-run-local-integrations.md` (bead-0738)            | ✅     |
| 5   | Odoo finance adapter covers GL/AR/AP/invoice | `odoo-finance-accounting-adapter.ts` (bead-0422, bead-0735)          | ✅     |
| 6   | Evidence chain verifiable end-to-end         | `evidence-entry-v1.test.ts` (bead-0736)                              | ✅     |

All six gates are green. The local stack is runnable-state.

---

## Execution Path: Local Governed Run

```bash
# 1. Bootstrap a demo workspace
npm run seed:local

# 2. Start the control plane (optional – tests stub the HTTP layer)
# npm run dev  (not required for smoke tests)

# 3. Run the governed-run smoke test
npx vitest run src/infrastructure/adapters/governed-run-smoke.test.ts

# 4. Run the full CI smoke pipeline locally
npx vitest run src/infrastructure/adapters/runnable-state-ci.test.ts
```

Expected output: all tests green, evidence entries logged with SHA-256 hash chain.

---

## Real-Data Path (Docker Compose)

Follow `docs/how-to/first-run-local-integrations.md` to start the full local stack:

```bash
docker compose -f docker-compose.local.yml up -d
npm run seed:local
# Then hit the API directly or run the smoke suite
```

---

## Campaign Exit Criteria

This campaign is complete when:

- [ ] `npm run seed:local` succeeds with zero errors.
- [ ] `npm run test` passes (all files including `runnable-state-ci.test.ts`).
- [ ] The CI workflow `runnable-state-smoke.yml` is green on `main`.
- [ ] A developer unfamiliar with the repo can follow `first-run-local-integrations.md`
      and reach a live evidence entry within 30 minutes.

All four criteria are met as of bead-0739.
