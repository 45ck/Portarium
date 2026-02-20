# Cockpit Page-Load QA Checklist

Date: 2026-02-20
Scope: Verify Cockpit route load behavior and baseline UI shell consistency.

## Automated

- Run `npm run -w apps/cockpit test`.
- Confirm `src/routes/page-load.test.tsx` passes all route smoke checks.

## Manual smoke

1. Start Cockpit: `npm run cockpit:dev`
2. Open the app in a browser.
3. Confirm sidebar shell always renders:
   - `Portarium` brand label
   - workspace footer `ws-demo`
4. Open each route and confirm the page heading is visible:
   - `/inbox`
   - `/dashboard`
   - `/work-items`
   - `/runs`
   - `/approvals`
   - `/evidence`
   - `/workforce`
   - `/workforce/queues`
   - `/config/agents`
   - `/config/adapters`
   - `/config/settings`
   - `/explore/objects`
   - `/explore/events`
   - `/explore/observability`
   - `/explore/governance`
   - `/robotics`
   - `/robotics/robots`
   - `/robotics/missions`
   - `/robotics/safety`
   - `/robotics/gateways`
5. Open detail routes and confirm they render without layout break:
   - `/work-items/wi-1001`
   - `/runs/run-2001`
   - `/approvals/apr-3001`
   - `/workforce/wfm-001`
6. Confirm `/` redirects to `/inbox`.

## Known notes

- Route smoke tests use fixture-backed fetch responses for deterministic page-load assertions.
- Breadcrumb markup was updated to remove invalid nested list items.
