# ADR-0146: Cockpit Local Extension Install Bridge

## Status

Accepted

## Context

Cockpit already hosts compile-time installed extension routes under `/external/*`. Development teams also need to smoke-test private or tenant-owned extension packages against Cockpit before those packages are published or registered through a production control-plane activation flow.

The bridge must not make Portarium commits depend on tenant-specific imports, private paths, credentials, or remote JavaScript. It must also preserve the existing fail-closed registry semantics: extension manifests describe routes and guards, while the host owns activation, package review, route imports, rendering, and egress controls.

## Decision

Portarium will provide a generic local extension install bridge:

- Committed code discovers ignored `apps/cockpit/src/lib/extensions/local-installed/*.local.ts` modules.
- Local modules export `CockpitInstalledExtension` records, not remote entry points.
- The installed registry merges built-in modules first, then local modules.
- The installed registry validates merged modules through the Cockpit extension SDK conformance report.
- Local modules are automatically activated only in the local Cockpit process by adding their pack ids, capabilities, API scopes, and privacy classes to the in-browser access context.
- Route modules that export a loader and no custom UI render through a generic data renderer rather than producing a blank route.
- Local filesystem allow-list and package aliasing are supplied through local Vite environment variables.

## Options Considered

1. Hardcode private extension imports in Portarium.
   - Rejected because it couples the generic host to a tenant package.

2. Require a published package before local testing.
   - Rejected because it slows iteration and still needs a local route import map.

3. Use ignored local install modules.
   - Accepted because it keeps committed code generic while allowing realistic local smoke tests.

## Consequences

- Portarium remains tenant-neutral in committed code.
- Local extension testing is reproducible by regenerating the ignored local install module and `.env.local`.
- Production activation still needs a control-plane-backed registry source.
- Developers must remove or regenerate ignored local install files when switching private extension packages.

## Validation

- Focused Cockpit extension tests cover local install discovery, installed catalog validation, route hosting, and loader-only route rendering.
- Cockpit production build passes without local install files.
- The egress scanner remains the guard for committed extension host code.
