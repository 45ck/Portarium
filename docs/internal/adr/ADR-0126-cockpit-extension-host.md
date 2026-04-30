# ADR-0126: Cockpit Extension Host

**Beads:** bead-1114, bead-1115, bead-1116, bead-1117, bead-1118, bead-1119, bead-1120, bead-1121, bead-1122, bead-1123
**Status:** Accepted
**Date:** 2026-04-30

## Context

Cockpit needs to support domain-specific operator surfaces without turning
Portarium core into a collection of tenant or vertical-specific screens.

The existing pack UI runtime can safely render declarative templates, schemas,
and theme tokens, but it is not a route or page plugin system. Route-level
extensions need executable React code, navigation metadata, commands, and guard
metadata. Loading those from remote JavaScript would expand the browser trust
boundary before the permission, egress, and audit model is proven.

## Decision

Use a compile-time Cockpit extension host for v1.

- Extension code is installed at build time through reviewed packages or local
  workspace links.
- Extension manifests are declarative metadata only.
- Executable route loaders are registered by the host-owned installed-extension
  catalog, not resolved from manifest strings at runtime.
- Workspace pack activation decides whether an installed extension is visible.
- External routes live under `/external/`.
- Cockpit mounts external route paths early enough for stable deep links, but
  imports route code only after host-owned activation and guard checks pass.
- The same resolved registry feeds routes, sidebar items, mobile navigation,
  command palette entries, and shortcuts.
- Remote arbitrary JavaScript is out of scope for v1.

## Guard Model

Every extension route, navigation item, command, and shortcut must declare host
guard metadata. The host decision includes:

- workspace pack activation,
- authenticated workspace/user scope,
- role or persona,
- required capabilities,
- required API scopes,
- privacy class constraints,
- route-module availability,
- host quarantine state.

Client-side persona selection is a UI convenience only. Production
authorization must be backed by server-provided identity and scopes.

## Browser Egress

Extension browser code may call only host-approved endpoints. For v1, this
means same-origin Portarium APIs and explicitly mediated backend-for-frontend
APIs. Extension code must not call systems of record directly.

The manifest cannot expand browser egress. Egress policy is host-owned and must
be covered by tests before real customer or operational source systems are
connected.

## Consequences

Positive:

- Keeps Portarium generic while allowing vertical-specific Cockpit surfaces.
- Gives stable deep links without loading unauthorized extension code.
- Makes extension visibility auditable and workspace-specific.
- Keeps the v1 security model testable: no remote JS, no manifest-driven imports,
  and fail-closed route hosting.

Negative:

- Adding or removing extension code requires a Cockpit build.
- Runtime marketplace-style plugins are deferred.
- External packages need a conformance path before they can be considered stable.
- Shell projection and guard behavior must be implemented before real systems
  are exposed through extensions.

## Alternatives Considered

- Runtime remote plugin bundles.
  - Rejected for v1 because route code would become a browser code-loading and
    egress risk before isolation is mature.
- Rebuilding the route tree per workspace.
  - Rejected for v1 because Cockpit workspace selection happens after startup and
    would complicate deep links and workspace switching.
- Hardcoding vertical routes in Cockpit core.
  - Rejected because it would make Portarium tenant or domain-specific and would
    not produce a reusable extension host.
- A single custom wildcard dispatcher with no route catalog.
  - Rejected as the default because it weakens deterministic route validation and
    makes shell projection harder to reason about.

## Implementation Mapping

This ADR is implemented through:

- `bead-1114` for the generic manifest and installed registry seam.
- `bead-1115` for compile-time external route hosting.
- `bead-1116` for workspace activation resolution.
- `bead-1117` for host-owned guard enforcement.
- `bead-1118` for registry-projected shell surfaces.
- `bead-1119` for the neutral reference extension and explorer hardening.
- `bead-1120` for external package install and route chunk boundaries.
- `bead-1121` for browser egress policy and tests.
- `bead-1122` for the regression matrix.
- `bead-1123` for later SDK and conformance graduation.

## Acceptance Evidence

- ADR document: `docs/internal/adr/ADR-0126-cockpit-extension-host.md`
- Generic registry code: `apps/cockpit/src/lib/extensions/`
- Generic route host work: `bead-1115`
- Workspace activation work: `bead-1116`
- Guard and egress work: `bead-1117`, `bead-1121`

## Remaining Gap Tracking

- Route hosting is not complete until direct `/external/` deep links fail closed
  before extension code import.
- Guarding is not production-ready until server-backed workspace/user scopes are
  used instead of client-only persona state.
- Browser egress is not production-ready until denied origins are enforced and
  tested.
- SDK graduation waits until the host, activation, guard, install-boundary, and
  regression matrix are stable.
