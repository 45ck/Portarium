# Cockpit Route Load QA Checklist

## Scope

- Route-level smoke verification for Cockpit primary and detail routes.
- Validate route navigation shell, header rendering, and baseline UI readiness.

## Automated verification

- `npm run test --workspace @portarium/cockpit -- src/routes/page-load.test.tsx`
- Expected: all route smoke cases pass.

## Manual checklist

- Open Cockpit and verify root shell renders:
  - Left navigation sidebar is visible.
  - Product mark `Portarium` is visible.
  - Workspace label `ws-demo` is visible.
- Verify primary routes load without blank state or crash:
  - `/dashboard`
  - `/inbox`
  - `/work-items`
  - `/runs`
  - `/approvals`
  - `/evidence`
  - `/workforce`
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
- Verify detail routes load with route-specific headings:
  - `/work-items/wi-1001`
  - `/runs/run-2001`
  - `/approvals/apr-3001`
  - `/workforce/wfm-001`
- Confirm no unhandled request errors in console/network panel.
- Confirm no route transition renders a blank page.
