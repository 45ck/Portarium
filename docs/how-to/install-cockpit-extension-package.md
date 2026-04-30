# Install A Cockpit Extension Package

Cockpit v1 loads extension UI at compile time. An external extension package is
compiled into the Cockpit bundle only after the host adds it to the host-owned
installed-extension import map. The package manifest describes metadata; it does
not decide which executable route modules the browser may import.

Use this handoff when a reviewed extension package needs to be installed in a
Cockpit build.

## Inputs

- Extension package name and pinned version or workspace path.
- `CockpitExtensionManifest` export.
- Route module exports for every route declared by the manifest.
- Workspace-scoped activation grant for the pack ID or IDs.
- Guard metadata for routes, navigation items, commands, and shortcuts.

## Package Shape

The package should expose a manifest and explicit route module loaders:

```ts
export { EXTENSION_MANIFEST } from './manifest';
export { EXTENSION_ROUTE_LOADERS } from './route-loaders';
```

Each loader key must match a manifest route ID:

```ts
export const EXTENSION_ROUTE_LOADERS = {
  'example-overview': () => import('./routes/overview'),
} as const;
```

The package must not rely on manifest strings being converted into imports at
runtime. Route loading remains a host decision.

## Install Steps

1. Add the package as a reviewed dependency or workspace link using the package
   manager already used by the repository.
2. Import the manifest and route loaders in
   `apps/cockpit/src/lib/extensions/installed.ts`.
3. Add one entry to `INSTALLED_COCKPIT_EXTENSION_MODULES` with the manifest and
   route module refs.
4. Add a workspace-scoped activation grant through
   `PORTARIUM_COCKPIT_EXTENSION_GRANTS_JSON`.
5. Keep every route under `/external/`.
6. Run the Cockpit extension registry and route-host tests.
7. Build Cockpit so the lazy route chunks are emitted by the host bundle.

## Host-Owned Import Map

`INSTALLED_COCKPIT_EXTENSION_MODULES` is the compile-time import map for
extension executable code. It binds:

- a reviewed manifest,
- route IDs declared by that manifest,
- host-owned dynamic imports for route components.

If a manifest declares a route without a matching host import, the registry must
treat it as an install mismatch. If a URL under `/external/` is not declared by
an enabled extension, the route host must fail closed before importing extension
code.

## Example Registry Entry

```ts
import { EXTENSION_MANIFEST, EXTENSION_ROUTE_LOADERS } from '@example/cockpit-extension';

export const INSTALLED_COCKPIT_EXTENSION_MODULES = [
  {
    manifest: EXTENSION_MANIFEST,
    routeModules: Object.entries(EXTENSION_ROUTE_LOADERS).map(([routeId, loadModule]) => ({
      routeId,
      loadModule,
    })),
  },
] as const satisfies readonly InstalledCockpitExtension[];
```

Use a neutral package and pack ID in examples and fixtures. Do not encode
organization, vertical, or vendor-specific names into generic Cockpit extension
docs.

## Activation Grant

The control plane activates installed extensions from scoped grants. Every
grant must name at least one `workspaceId`; unscoped and principal-only grants
are ignored. Use `principalIds`, `roleIncludes`, and `scopeIncludes` only to
narrow a workspace grant further.

`availableApiScopes` is a visibility filter over the authenticated token's API
scopes. It cannot grant new API scopes. If a grant lists `approvals.read` but
the token does not contain `approvals.read`, Cockpit will not expose that API
scope to extension guard checks.

`availablePrivacyClasses` is the server-issued set of privacy classes the
current Workspace/principal context may inspect. Routes or commands declaring
privacy classes remain hidden from navigation, commands, shortcuts, and direct
`/external/` entry until the matching class is present.

```json
[
  {
    "workspaceIds": ["ws-local-dev"],
    "roleIncludes": ["admin"],
    "scopeIncludes": ["extensions.read"],
    "activePackIds": ["example.ops-demo"],
    "availableCapabilities": ["asset:read", "incident:read", "evidence:read"],
    "availableApiScopes": ["extensions.read", "approvals.read", "evidence.read"],
    "availablePrivacyClasses": ["internal", "restricted"]
  }
]
```

Set the JSON as `PORTARIUM_COCKPIT_EXTENSION_GRANTS_JSON`. Use
`quarantinedExtensionIds` to suppress a specific installed extension by manifest
ID without uninstalling its package.

Cockpit treats activation as fail-closed. Installed extensions are disabled
until their pack IDs are explicitly active for the current workspace, unknown
active pack IDs mark the registry invalid, and partially satisfied pack
requirements do not expose routes, navigation, mobile navigation, commands, or
shortcuts. Direct visits to disabled or unauthorized `/external/` routes use a
host fallback and do not import extension route code.

## Verification

Run the smallest relevant checks before handoff:

```bash
npm run cockpit:build
node node_modules/vitest/vitest.mjs run apps/cockpit/src/lib/extensions apps/cockpit/src/components/cockpit/extensions apps/cockpit/src/routes/external
```

For documentation-only changes, run:

```bash
npm run docs:lint
```

## Handoff Notes

Record these in the handoff:

- package name and pinned version or commit,
- manifest ID and activated pack IDs,
- routes added under `/external/`,
- checks run,
- any guard, egress, or registry problems left unresolved.
