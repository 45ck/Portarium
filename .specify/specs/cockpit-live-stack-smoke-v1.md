# Cockpit Live-Stack Smoke v1

**Bead:** bead-1138
**Status:** accepted

## Purpose

Cockpit must prove that core operator routes work against a seeded live
control-plane API, not only against MSW fixtures. The release gate must catch a
build that boots only in mock mode or a UI that reads live data but cannot submit
a persisted approval decision.

## Scope

The live-stack smoke covers the local workspace `ws-local-dev` seeded by
`npm run seed:cockpit-live`.

Required live reads:

- runs: `run-live-001` and `run-live-002`
- approval: `apr-live-001`
- work item: `wi-live-001`
- run evidence: `ev-live-001` and `ev-live-002`

Required live write:

- approve `apr-live-001` through Cockpit UI
- verify the persisted approval status and rationale through an independent API read
- verify approval decision evidence exists for `apr-live-001`

## Gate Behaviour

- `npm run ci:cockpit:live-stack-smoke` is wired into `ci:pr`.
- If no local API is reachable and the gate is not marked required, it exits 0
  with a skip message so normal developer PR checks do not require Docker.
- `npm run ci:cockpit:live-stack-smoke:required` or
  `PORTARIUM_LIVE_STACK_SMOKE_REQUIRED=true` makes an unreachable API fail.
- When the API is reachable, the runner seeds and validates the live Cockpit
  data before running Playwright.
- Playwright starts Cockpit with `VITE_PORTARIUM_ENABLE_MSW=false` and
  `VITE_PORTARIUM_API_BASE_URL=http://localhost:8080`.

## Evidence

Automated evidence is written by Playwright under
`qa-artifacts/playwright-live-stack/` and `playwright-report/live-stack/`.
Manual release evidence follows
`docs/internal/qa/cockpit-live-agent-browser-checklist.md` and is promoted to
`docs/internal/review/artifacts/bead-1138/live-stack/<stamp>/`.

## Acceptance

- The smoke fails if MSW is the only working data source.
- The smoke fails if the seeded approval is missing or already decided before the run.
- The smoke fails if the approval decision request does not persist status, rationale, and evidence.
- Runtime `console.error` and page errors fail the smoke.
- Release docs link to the latest evidence manifest and list unsupported surfaces.
