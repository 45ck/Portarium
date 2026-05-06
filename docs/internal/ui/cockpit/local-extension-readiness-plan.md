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

## Generic Shell Readiness

Cockpit extensions can tailor the host shell without committing tenant-specific code to Portarium. The generic contract is `manifest.shellContributions.modes[]`, selected locally with `VITE_COCKPIT_SHELL_MODE` until workspace-scoped activation is added.

Supported host shell controls:

- `coreSections`: hide, show, mark advanced, or reorder built-in sidebar sections.
- `coreItems`: hide, show, mark advanced, or reorder built-in sidebar items.
- `extensionNav`: reorder extension navigation and promote extension items to mobile primary navigation.
- `mobilePrimaryCoreItemIds`: replace the default mobile primary core items with known host item ids.
- `globalActions`: hide or re-show host global actions such as `create-run`, `plan-intent`, `action:new-run`, `action:plan-new-beads`, `action:register-agent`, and `setting:switch-dataset`.
- `defaultRoute`: redirect `/` to an enabled concrete extension route.
- `sidebarExtensionInsertAfterSectionId`: choose where extension navigation is inserted among host sections.

Invalid references fail closed: Cockpit falls back to the default Portarium shell profile when a shell mode references unknown host ids, unknown extension nav ids, unknown routes, or parameterized default routes.

Production activation is still control-plane work. Local activation remains development-only and must not commit private imports, local package names, private filesystem paths, or tenant names to Portarium.

## Sidebar Readiness Classification

| Sidebar item | Current state | Notes |
| ------------ | ------------- | ----- |
| Inbox, Dashboard, Projects, Work Items | API-backed core surfaces | Live-ready when the control-plane API is available. |
| Runs, Workflows, Approvals, Evidence | API-backed core surfaces | Live-ready for read paths; mutation paths remain governed by existing approval/run contracts. |
| Search | API-backed with fixture fallback | Live readiness depends on embedding, semantic index, and graph ports being wired. |
| Machines, Agents, Adapters, Credentials, Users, Extensions | API-backed configuration surfaces | Live-ready for read paths where corresponding server routes are present. |
| Policies | Mixed | Policy reads are API-backed; studio/detail editing has explicit demo or disabled live states. |
| Capability Posture | Prototype | Static matrix until persisted capability-default and activation contracts exist. |
| Governance | Mixed | Policy/evidence/workflow reads are API-backed; SoD fixtures are demo-only. |
| Observability | Derived read model | Aggregates live Cockpit entities but is not yet backed by a dedicated telemetry endpoint. |
| Workforce Coverage | Prototype | Members and queues are API-backed; coverage planning is fixture-backed in demo mode. |
| Blast Radius, Pack Runtime, Robotics | Demo/high-fidelity prototype | These surfaces must remain demo-gated or clearly unavailable in live mode. |
| Tenant or vertical workspaces | Extension-owned | Tenant navigation, data areas, maps, tickets, and dashboards belong in private extensions only. |

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
