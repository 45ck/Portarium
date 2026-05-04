# ADR-0145: Generic Cockpit Plugin Host Control Plane

**Beads:** bead-1054, bead-1062, bead-1114, bead-1115, bead-1116, bead-1117, bead-1118, bead-1119, bead-1120, bead-1121, bead-1122, bead-1123
**Status:** Proposed
**Date:** 2026-05-04

## Context

ADR-0126 establishes the v1 Cockpit extension host as a compile-time route host.
ADR-0141 establishes the broader Portarium plugin extensibility model. The next
planning gap is the generic control-plane model that makes those extension
surfaces reusable across workspaces without embedding tenant, customer, or
vertical-specific assumptions in Cockpit or Portarium core.

The model must cover the operational contract between an extension package, the
Cockpit host, and the Portarium control plane: manifest shape, route/navigation
projection, widget projection, permission grants, read-only data scopes,
evidence-query limits, packaging, lifecycle, quarantine, and host
responsibilities.

## Drivers

- Keep Cockpit as one coherent operator surface.
- Keep Portarium core generic and tenant-neutral.
- Let extension packages add routes, navigation, widgets, commands, and review
  surfaces without owning governance truth.
- Make permissions and data access explainable, auditable, and fail-closed.
- Keep browser code away from secrets, systems of record, unmanaged egress, and
  direct side effects.
- Make extension packages reviewable before a package is compiled into Cockpit.

## Decision Problem

Portarium needs a reusable plugin host/control-plane contract that lets
extension authors contribute operator surfaces while preserving Portarium
authority for workspace activation, policy, approval, evidence, tenancy, audit,
egress, and lifecycle state.

## Options Considered

| Option | Summary                                                                                      | Generic fit | Security fit | Operability | Decision |
| ------ | -------------------------------------------------------------------------------------------- | ----------- | ------------ | ----------- | -------- |
| A      | Hardcode extension-specific routes in Cockpit                                                | Low         | Medium       | Low         | Rejected |
| B      | Let manifests directly drive imports, permissions, and data endpoints                        | Medium      | Low          | Low         | Rejected |
| C      | Use a host-owned installed registry with control-plane activation and read-only query grants | High        | High         | High        | Selected |
| D      | Defer plugin host work until marketplace packaging exists                                    | Medium      | Medium       | Low         | Rejected |

### Option A: Hardcoded Routes

Hardcoding plugin routes in Cockpit is fast for isolated cases, but it turns
domain or customer surfaces into core product code. It also creates duplicate
permission and navigation handling as more extensions appear.

### Option B: Manifest-Driven Runtime Authority

Allowing a manifest to define imports, endpoints, or permission grants would
make package installation flexible, but it lets package metadata become an
authority source. That weakens the fail-closed model and conflicts with
ADR-0126.

### Option C: Host-Owned Registry With Control-Plane Activation

The host owns executable imports and projection logic. The control plane owns
activation, effective permissions, evidence-query boundaries, lifecycle, and
audit truth. The manifest remains descriptive and reviewable.

Selected because it preserves Cockpit extensibility without moving authority
into extension packages.

### Option D: Defer Until Marketplace

Waiting for a full marketplace would avoid near-term design churn, but it
blocks reusable operator-surface work and leaves each extension path to invent
its own guard, projection, and packaging conventions.

## Decision

Adopt a generic Cockpit plugin host/control-plane model built around a
host-owned installed registry, descriptive manifests, server-issued activation
context, and bounded read-only query grants.

The v1 host remains compile-time installed. Runtime remote JavaScript, manifest
imports, manifest-declared egress, and plugin-owned permission grants remain out
of scope.

## Control-Plane Contract

The Portarium control plane is the authority for:

- workspace extension activation,
- effective capability and API-scope grants,
- read-only data-scope grants,
- evidence-query limits,
- privacy-class eligibility,
- lifecycle state,
- quarantine and emergency disable,
- audit and evidence events,
- governed action request outcomes.

The Cockpit host requests a server-issued extension context for the active
workspace and principal. That context must contain only effective grants after
workspace, principal, role, token scope, privacy class, package lifecycle, and
quarantine decisions have been resolved.

## Manifest Contract

Each plugin manifest must declare:

- stable extension ID, package name, publisher, version, and support contact,
- compatible host-contract version and SDK version,
- required pack or activation keys,
- route contributions under `/external/`,
- navigation contributions and placement hints,
- widget contributions with target slots, size hints, and refresh policy,
- command palette and shortcut contributions,
- required capabilities, API scopes, privacy classes, and read-only data scopes,
- evidence-query intents and maximum expected result shape,
- governed action intents the UI may request,
- package provenance, attestation, rollback, and emergency-disable metadata.

The manifest must not declare:

- executable imports,
- remote entry URLs,
- browser egress origins,
- credentials or secret references,
- direct provider endpoints,
- direct systems-of-record endpoints,
- permission grants,
- policy overrides,
- approval authority,
- raw HTML or executable event payloads.

## Route, Nav, And Widget Registration

The installed registry binds reviewed manifests to host-owned route module
loaders. Route IDs in the registry must match route IDs in the manifest.

Route registration rules:

- all contributed pages mount below `/external/`,
- direct deep links resolve activation and guard state before importing route
  code,
- undeclared or disabled routes fail closed through a host fallback,
- route metadata declares required capabilities, API scopes, privacy classes,
  data scopes, and evidence-query intents.

Navigation registration rules:

- navigation items are projected only from enabled, guarded routes,
- sidebar, mobile navigation, command palette, and shortcut projection use the
  same resolved registry state,
- a hidden route cannot leak through search, shortcuts, breadcrumbs, or command
  aliases.

Widget registration rules:

- widgets render only in host-owned slots,
- widgets declare a stable widget ID, slot, size, refresh interval, empty state,
  and guard metadata,
- widgets use host data helpers and cannot start background fetches until their
  guards and evidence-query boundaries are satisfied,
- widgets must degrade independently so one failed widget does not disable the
  host shell.

## Permission And Read-Only Scope Model

Permissions are separated into five inputs:

| Input                | Purpose                                                          | Authority                     |
| -------------------- | ---------------------------------------------------------------- | ----------------------------- |
| Capability           | What an operator may inspect or reason about                     | Control plane                 |
| API scope            | Which Portarium APIs the Cockpit client may call                 | Auth token plus control plane |
| Read-only data scope | Which bounded query families an extension may request            | Control plane                 |
| Action intent        | Which governed commands the extension may request                | Manifest plus policy          |
| Policy result        | Whether a requested action is allowed, denied, or needs approval | Control plane                 |

Read-only scopes are not mutation authority. They allow host-mediated queries
such as `runs.read.summary`, `approvals.read.queue`, or
`evidence.read.linkedArtifacts` only after the control plane issues effective
workspace and principal grants. Unknown or partially satisfied grants fail
closed.

## Evidence Query Boundaries

Evidence queries exposed to extensions must be bounded by:

- workspace ID and principal context,
- explicit entity anchors such as Work Item, Run, Approval, Plan, Policy
  version, Evidence Entry, or Evidence Artifact,
- declared privacy classes,
- server-defined page size and time window limits,
- redacted payload policy,
- chain-integrity and provenance metadata,
- correlation ID or source reference where available.

Extension code may request evidence summaries, linked artifacts, provenance
metadata, and chain status through host helpers. It must not perform open-ended
evidence search, raw blob enumeration, cross-workspace lookup, or direct storage
access.

## Extension Packaging

Extension packages are reviewed dependencies or workspace links compiled into a
Cockpit build. A package must provide:

- a typed manifest export,
- explicit route module exports,
- conformance test output,
- pinned package version or commit,
- package provenance and attestation digest,
- compatibility metadata for host-contract and SDK versions,
- install, rollback, support, and emergency-disable notes.

Package installation does not activate the extension. Activation requires a
workspace-scoped control-plane grant.

## Host Responsibilities

The Cockpit host is responsible for:

- maintaining the installed extension registry,
- validating manifests and registry consistency at build/test time,
- requesting effective extension context from the control plane,
- resolving lifecycle, activation, guard, and quarantine state before import,
- projecting routes, nav, widgets, commands, shortcuts, and search aliases from
  one resolved registry,
- providing host API helpers for approved Portarium queries and governed action
  requests,
- enforcing browser egress policy and reporting denials,
- rendering fail-closed, degraded, empty, and unauthorized states,
- recording extension render, denial, activation, and command-request evidence
  where required.

The host must not become an alternate policy engine. It consumes effective
control-plane decisions and performs local fail-closed enforcement before code
import, rendering, data loading, or command dispatch.

## Consequences

Positive:

- Extension packages can add reusable operator surfaces without making
  Portarium domain-specific.
- Permission, evidence, and lifecycle behavior remains centralized and
  auditable.
- Route, nav, widget, command, and shortcut projection use one consistent guard
  model.
- The package review boundary remains compatible with ADR-0126 and ADR-0141.

Negative:

- v1 packages still require a Cockpit build.
- Extension authors must model data needs through bounded Portarium scopes
  rather than arbitrary endpoint access.
- The control plane must expose a durable extension-context contract before
  third-party package rollout.

## Implementation Mapping

- Planning record:
  `docs/internal/ui/cockpit/generic-plugin-host-implementation-plan.md`
- Existing route-host decision:
  `docs/internal/adr/ADR-0126-cockpit-extension-host.md`
- Existing broader extensibility decision:
  `docs/internal/adr/ADR-0141-cockpit-portarium-plugin-extensibility.md`
- Install handoff:
  `docs/how-to/install-cockpit-extension-package.md`
- SDK contract:
  `docs/sdk/cockpit-extension-sdk.md`

## Acceptance Evidence

- A manifest schema covers route, navigation, widget, command, shortcut,
  permissions, read-only scopes, evidence-query intents, lifecycle, and package
  metadata.
- The installed registry rejects manifest/route mismatch before runtime.
- Direct `/external/` links fail closed before route-code import when activation
  or guards are missing.
- Navigation, widgets, command palette, shortcuts, and route access are derived
  from the same resolved registry.
- Evidence queries are anchored, paginated, privacy-checked, and redacted by
  host-mediated APIs.
- Emergency disable and quarantine suppress routes, nav, widgets, commands,
  shortcuts, background data loading, and direct deep links.

## Remaining Gap Tracking

- The extension-context API must be versioned and documented as a stable control
  plane contract.
- Read-only data-scope names need a registry and compatibility policy.
- Evidence-query helpers need conformance tests for anchoring, pagination,
  privacy-class handling, and redaction.
- Widget-slot projection needs host UI acceptance tests.
- Package provenance and attestation enforcement must be wired into install and
  release gates before external marketplace behavior is reconsidered.
