# Cockpit Local Extension Readiness Plan

## Summary

This plan defines the acceptance checks for taking an external Cockpit extension from package-level contract readiness to a locally runnable Cockpit route.

The committed Portarium side stays tenant-neutral. Tenant-specific local wiring belongs in ignored `apps/cockpit/src/lib/extensions/local-installed/*.local.ts` files and local environment files.

## Acceptance Checklist

| Area                     | Acceptance outcome                                                                                               | Evidence                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extension registration   | Cockpit can merge built-in extension modules with local extension modules.                                       | `apps/cockpit/src/lib/extensions/installed.ts` merges `LOCAL_COCKPIT_EXTENSION_MODULES`.                                                                   |
| Installed registry       | The installed registry no longer assumes that the neutral example extension is the only installed module.        | `INSTALLED_COCKPIT_EXTENSION_MODULES` is the single source for manifests, route loaders, route paths, and validation.                                      |
| Contract alignment       | Installed modules are checked with the SDK conformance helper before becoming available to registry consumers.   | `createCockpitExtensionManifestV1ConformanceReport` is called from the installed catalog validation path.                                                  |
| Local-only import bridge | Private extension imports can be tested locally without committed tenant imports, private paths, or credentials. | `.gitignore` excludes `apps/cockpit/src/lib/extensions/local-installed/`; `local-install.ts` discovers those files only when local extensions are enabled. |
| Route hosting            | `/external/*` routes can load either component routes or loader-only route modules.                              | `external-route-components.tsx` adapts route modules and `external-route-data-renderer.tsx` renders loader-only data.                                      |
| Access context           | Local extension packs are activated only inside the local Cockpit runtime.                                       | `withLocalCockpitExtensionActivation` augments pack ids, capabilities, API scopes, personas, and privacy classes when local modules exist.                 |
| Documentation            | Maintainers can reproduce local install, run, and smoke validation steps.                                        | `local-extension-install-bridge.md` and this plan are linked from the Cockpit docs index.                                                                  |

## Implementation Slices

1. Generic bridge
   - Discover ignored local install modules through Vite glob imports.
   - Keep local discovery disabled by default and disabled during tests unless explicitly enabled.
   - Report malformed local modules as catalog problems instead of crashing unrelated routes.

2. Registry and route host
   - Build all installed extension projections from the merged installed module list.
   - Validate installed manifests through the SDK conformance report.
   - Resolve route host definitions from installed modules and their route loaders.

3. Runtime rendering
   - Preserve support for React component route modules.
   - Render loader-only route modules through a generic data renderer.
   - Keep unsupported route module shapes fail-closed with route-level problems.

4. Local developer workflow
   - Tenant repo writes ignored install files into the Cockpit checkout.
   - Local `.env.local` supplies only filesystem allow-list and aliases needed for the local build.
   - Cockpit dev server is restarted after local env or Vite config changes.

5. Validation
   - Run focused extension tests before broader Cockpit checks.
   - Run Cockpit build to verify bundle resolution.
   - Run the egress scanner so committed host code stays constrained.

## Test Focus

```powershell
npm run -w apps/cockpit test -- src/lib/extensions/local-install.test.ts src/lib/extensions/installed.test.ts src/components/cockpit/extensions/external-route-components.test.tsx src/routes/external/external-route-host.test.tsx src/routes/explore/extensions.test.tsx
npm run -w apps/cockpit build
node scripts/ci/check-cockpit-extension-egress.mjs
```

## Done Criteria

- A local install file can register a private extension without changing committed Portarium source.
- The extension appears in the extension catalog.
- Declared external routes open without not-found or restricted states when local activation is enabled.
- The committed Portarium diff contains no tenant-specific names, package imports, credentials, or filesystem paths.

## Remaining Production Work

The local bridge is a development workflow. Production activation still needs a control-plane-backed registry source that can install reviewed extension packages, bind them to workspaces, and grant only approved capabilities.
