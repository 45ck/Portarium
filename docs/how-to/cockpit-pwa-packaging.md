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
- Read API cache (network-first with cache fallback):
  - `/v1/workspaces/:id/approvals`
  - `/v1/workspaces/:id/runs`
  - `/v1/workspaces/:id/work-items`

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
