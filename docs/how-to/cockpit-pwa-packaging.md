# Cockpit PWA Packaging

This guide documents the installable Cockpit PWA baseline for mobile devices.

## What Is Included

- Web app manifest at `apps/cockpit/public/site.webmanifest`
- Service worker at `apps/cockpit/public/sw.js`
- Runtime registration and update flow in `apps/cockpit/src/main.tsx`

## Installability Baseline

- Manifest includes:
  - `name`, `short_name`, `start_url`, `scope`, `id`
  - `display` and `display_override`
  - `theme_color` and `background_color`
  - app icons (192, 512, adaptive 512)
- `apps/cockpit/index.html` links the manifest and icons.

## Caching Strategy

- Shell cache:
  - `/`
  - `/index.html`
  - `/site.webmanifest`
  - `/favicon.svg`
- Runtime cache:
  - same-origin scripts, styles, fonts, and images (cache-first)
- Read API cache (network-first with cache fallback, disabled for live tenant data by default):
  - `/v1/workspaces/:id/approvals`
  - `/v1/workspaces/:id/runs`
  - `/v1/workspaces/:id/work-items`

## Mode and Retention Matrix

| Mode            | Service worker                                                          | Tenant API caching                                              |
| --------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| Demo/mock       | Shell/static cache plus selected synthetic read caching                 | Allowed for fixtures                                            |
| Dev live QA     | Shell/static cache; tenant API cache disabled unless explicitly enabled | Disabled by default                                             |
| Production live | Shell/static assets only by default                                     | Disabled unless `VITE_PORTARIUM_ENABLE_LIVE_OFFLINE_CACHE=true` |

Logout, workspace switch, and auth failure purge the React Query persistence key
`portarium-cockpit-query-cache-v1`, local offline entries under
`portarium:cockpit:offline:*`, approval outbox entries under
`portarium:cockpit:approval-outbox:v1:*`, IndexedDB database
`portarium-cockpit-offline`, and Cache Storage keys beginning with
`portarium-cockpit-pwa-`.

## Update Strategy

- New worker is staged; existing worker continues serving current clients.
- When an update is ready, Cockpit shows a toast with `Update`.
- Pressing `Update` sends `SKIP_WAITING`.
- On `controllerchange`, Cockpit reloads once to activate the new worker.

This keeps rollback safe by default: users stay on the current active worker until they explicitly apply the update.

## Platform Constraints and Fallback

- PWA install support varies by browser and OS.
- If service workers are unavailable or registration fails, Cockpit remains fully usable as a normal web app.
- Offline shell and cached-read behavior are only available when service workers are supported and active.
