# Cockpit Local Extension Install Bridge

## Summary

Cockpit can load additional extension install records from ignored local files during development. The bridge is generic: committed Portarium code declares the loader and guard rails, while tenant- or environment-specific install files stay outside version control.

## Boundary

- Committed Portarium files may define extension contracts, validation, rendering, and local discovery mechanics.
- Local install files live under `apps/cockpit/src/lib/extensions/local-installed/*.local.ts`.
- Local install files are ignored by git and may contain private package imports, local filesystem paths, or tenant-specific package names.
- Local public assets live under `apps/cockpit/public/assets/local-extensions/<extension-id>/`.
- Local public assets are ignored by git and are served by Vite at `/assets/local-extensions/<extension-id>/...`.
- Local install files must export either one `CockpitInstalledExtension` or an array of `CockpitInstalledExtension` records.
- The host still owns route activation, route loaders, package refs, workspace pack refs, and fail-closed validation.
- Local install files, local assets, and local package aliases are private
  development artifacts only. They are not a public publishing path and must not
  be committed as tenant-specific distribution state.

## Runtime Flow

1. `local-install.ts` discovers ignored `*.local.ts` modules at build time.
2. `installed.ts` merges local modules after built-in extensions.
3. The SDK conformance report validates installed manifests, package refs, workspace pack refs, route module ids, widgets, and data scopes.
4. If local modules exist, Cockpit adds their pack ids, declared capabilities, API scopes, and privacy classes to the local access context.
5. Route host definitions are projected from the same installed registry as built-in extensions.
6. Route modules with a default React component render normally.
7. Route modules with a loader and no custom component render through the generic route-data renderer.

## Local Environment

Use `apps/cockpit/.env.local` for local-only aliases and filesystem allow-list entries:

```env
VITE_COCKPIT_ENABLE_LOCAL_EXTENSIONS=true
VITE_COCKPIT_LOCAL_EXTENSION_ALLOW_DIRS=C:/path/to/local/extension/repo
VITE_COCKPIT_LOCAL_EXTENSION_ALIASES=@scope/package=C:/path/to/package/src/index.ts
VITE_COCKPIT_SHELL_MODE=operator
```

Multiple allow dirs and aliases can be separated with semicolons, commas, or new lines.
`VITE_COCKPIT_SHELL_MODE` is optional and selects a generic extension-contributed
shell mode when an installed extension declares one. Without it, Cockpit uses the
default Portarium shell profile.

If an extension route needs local static files, copy them into:

```text
apps/cockpit/public/assets/local-extensions/<extension-id>/
```

Reference those files with absolute Cockpit URLs such as:

```text
/assets/local-extensions/<extension-id>/example.svg
```

## Validation

Run these checks after changing the bridge:

```bash
npm run -w apps/cockpit test -- src/lib/extensions/local-install.test.ts src/lib/extensions/installed.test.ts src/components/cockpit/extensions/external-route-components.test.tsx src/routes/external/external-route-host.test.tsx
npm run -w apps/cockpit build
node node_modules/vitest/vitest.mjs run packages/cockpit-extension-sdk/src/conformance.test.ts
node scripts/ci/check-cockpit-extension-egress.mjs
```

For route smoke evidence that depends on stable local URLs, start Cockpit with:

```bash
npm run -w apps/cockpit dev:e2e -- --host 127.0.0.1
```

Then capture the relevant local extension routes from `127.0.0.1:5173` after
the ignored local install files and any ignored local assets have been generated.
Those screenshots are local evidence only; do not publish tenant-specific local
assets or route captures as public Portarium artifacts.

## Risks

- A local install file can make local builds depend on private paths. Keep those files ignored.
- Local extension activation is a development convenience, not a production authorization source.
- If a route module exports neither a component nor a loader, Cockpit renders an error surface rather than blank content.
