# Generic Cockpit Plugin Host PDR And Implementation Plan

> **Beads:** bead-1054, bead-1062, bead-1114, bead-1115, bead-1116, bead-1117, bead-1118, bead-1119, bead-1120, bead-1121, bead-1122, bead-1123
> **Date:** 2026-05-04
> **Status:** Proposed
> **Decision record:** `docs/internal/adr/ADR-0145-generic-cockpit-plugin-host-control-plane.md`

## 1. Purpose

Define the implementation path for a reusable Cockpit plugin host and
Portarium control-plane contract. The plan is intentionally generic: no tenant,
customer, provider, or vertical-specific names are part of the host contract.

## 2. Product Decision Record

### Problem

Cockpit needs reusable plugin surfaces for routes, navigation, widgets,
commands, and review panels, but those surfaces must not bypass Portarium
authority for activation, permissions, evidence, policy, tenancy, egress, or
lifecycle state.

### Options

| Option | Description                                                            | Pros                                          | Cons                                            | Decision |
| ------ | ---------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------- | -------- |
| A      | Keep plugins as ad hoc Cockpit code                                    | Fast for one surface                          | No reusable contract; weak guard consistency    | Reject   |
| B      | Let manifests drive runtime imports and grants                         | Flexible package rollout                      | Manifest becomes authority; larger browser risk | Reject   |
| C      | Build a generic host-owned registry backed by control-plane activation | Reusable, auditable, compatible with ADR-0126 | More upfront contract work                      | Select   |

### Decision

Implement Option C. Cockpit owns executable imports and shell projection.
Portarium owns effective activation, permissions, read-only scopes,
evidence-query boundaries, lifecycle, quarantine, and audit truth.

### Non-Goals

- No runtime remote JavaScript plugins.
- No manifest-driven imports.
- No plugin-owned permission grants.
- No browser-side secrets.
- No direct browser calls to systems of record, provider APIs, vaults, gateways,
  or runtime daemons.
- No extension-owned approval, policy, evidence, or execution state machine.

## 3. Scope

In scope:

- manifest v1 additions for route, nav, widget, command, shortcut, permission,
  read-only data-scope, evidence-query, package, and lifecycle metadata,
- installed registry validation,
- server-issued extension context,
- route, navigation, widget, command, and shortcut projection,
- read-only scope and evidence-query boundary enforcement,
- package install handoff and conformance checks,
- host degraded, unauthorized, quarantined, disabled, and mismatch states.

Out of scope:

- public marketplace behavior,
- runtime-downloaded bundles,
- arbitrary generated executable UI,
- direct storage access for evidence blobs,
- source-code implementation in this planning slice.

## 4. Contract Shape

### Manifest

Required top-level sections:

| Section           | Required content                                                                 |
| ----------------- | -------------------------------------------------------------------------------- |
| `identity`        | Extension ID, display name, publisher, package name, version                     |
| `compatibility`   | Host-contract version, SDK version, minimum Cockpit version                      |
| `activation`      | Pack IDs or activation keys required for visibility                              |
| `routes`          | `/external/` route IDs, paths, titles, route module IDs, guards                  |
| `navigation`      | Item IDs, route refs, placement hints, order, guards                             |
| `widgets`         | Widget IDs, slot refs, route/detail anchors, size hints, refresh policy, guards  |
| `commands`        | Command IDs, labels, shortcut refs, governed action intents, guards              |
| `permissions`     | Required capabilities, API scopes, privacy classes, read-only data scopes        |
| `evidenceQueries` | Allowed anchors, summary/detail level, maximum page size, redaction expectations |
| `governance`      | Audit event names, emergency disable notes, rollback notes                       |
| `package`         | Provenance, attestation digest, support contact, conformance report ref          |

Forbidden fields:

- remote entry URLs,
- import paths used as runtime strings,
- egress allowlists,
- API base URLs,
- credentials,
- secret references,
- provider endpoint URLs,
- policy overrides,
- approval authority,
- raw HTML or event handler payloads.

### Extension Context

The control plane should issue a versioned extension context with:

- workspace ID,
- principal ID or stable subject reference,
- active extension IDs and pack IDs,
- quarantined and emergency-disabled extension IDs,
- effective capabilities,
- effective API scopes,
- effective privacy classes,
- effective read-only data scopes,
- evidence-query limits,
- host/API origin policy reference,
- lifecycle state and reason codes,
- correlation ID for audit and denial events.

The context is an effective grant set. Cockpit must not merge in manifest
requirements as grants.

## 5. Registration Rules

### Routes

- All plugin routes live under `/external/`.
- Route IDs are stable and unique per extension.
- Route module IDs must be matched by the host-owned installed registry.
- Direct links resolve activation, lifecycle, privacy class, API scopes,
  capabilities, read-only scopes, and route availability before code import.
- Unknown, disabled, unauthorized, quarantined, or mismatched routes use a host
  fallback.

### Navigation

- Sidebar, mobile navigation, breadcrumbs, search aliases, command palette, and
  shortcuts must project from the same resolved registry.
- A hidden route cannot appear through secondary navigation.
- Navigation items cannot grant route access.

### Widgets

- Widgets render in host-owned slots only.
- Widget slots define allowed density and refresh constraints.
- Widgets declare whether they are global, route-specific, entity-specific, or
  evidence-anchored.
- Widgets cannot fetch data until guard and evidence-query checks pass.
- Widget failures degrade the widget, not the shell.

## 6. Permissions And Read-Only Scopes

Implement permission checks as a conjunction:

1. Package is installed and registry-valid.
2. Extension is active for the workspace.
3. Extension is not quarantined or emergency disabled.
4. Principal has required capability grants.
5. Principal has required API scopes after token intersection.
6. Principal has required privacy classes.
7. Principal has required read-only data scopes.
8. Route/widget/command-specific guards pass.

Read-only scopes should be named by query family and access level, for example:

- `workItems.read.summary`
- `runs.read.summary`
- `runs.read.timeline`
- `approvals.read.queue`
- `evidence.read.summary`
- `evidence.read.linkedArtifacts`
- `policies.read.evaluationSummary`

Mutation remains a governed action request, not a read-only scope.

## 7. Evidence Query Boundaries

Every plugin evidence query must declare and enforce:

- anchor type: Work Item, Run, Approval, Plan, Policy version, Evidence Entry,
  or Evidence Artifact,
- anchor ID source: route param, selected host entity, or command payload,
- maximum page size,
- maximum time window,
- privacy classes,
- redaction profile,
- allowed summary/detail level,
- whether artifact bytes are excluded, linked, or previewed through a mediated
  endpoint.

Default posture:

- no cross-workspace evidence queries,
- no unanchored full-text evidence search,
- no raw blob listing,
- no evidence payloads without redaction,
- no query continuation after activation or guard state changes.

## 8. Implementation Milestones

### M0: Contract Alignment

Exit criteria:

- [ ] ADR-0145 is accepted or amended.
- [ ] Manifest fields and forbidden fields are reflected in SDK docs.
- [ ] Read-only data-scope naming rules are agreed.
- [ ] Evidence-query boundary rules are linked from SDK and install docs.

### M1: Manifest And Registry

Exit criteria:

- [ ] Manifest schema includes routes, nav, widgets, commands, shortcuts,
      permissions, read-only scopes, evidence-query intents, package metadata, and
      lifecycle metadata.
- [ ] Installed registry rejects route module mismatch, duplicate IDs, forbidden
      fields, missing guards, and invalid `/external/` paths.
- [ ] Neutral reference extension exercises one route, one nav item, one widget,
      and one command.

### M2: Control-Plane Extension Context

Exit criteria:

- [ ] Extension context endpoint returns effective grants only.
- [ ] Token scopes intersect API-scope visibility.
- [ ] Workspace activation is required.
- [ ] Quarantine and emergency disable suppress all contributed surfaces.
- [ ] Denial metadata includes extension, surface, reason, workspace, principal,
      and correlation ID.

### M3: Shell Projection

Exit criteria:

- [ ] Routes, sidebar items, mobile navigation, command palette, shortcuts,
      widgets, breadcrumbs, and search aliases project from the same resolved
      registry.
- [ ] Secondary surfaces cannot reveal disabled or unauthorized routes.
- [ ] Direct `/external/` links fail closed before route-code import.

### M4: Read-Only Data And Evidence Helpers

Exit criteria:

- [ ] Host helpers enforce read-only data scopes.
- [ ] Evidence helpers require anchors, page limits, redaction profiles, and
      privacy classes.
- [ ] Background widget refresh stops when activation or guard context changes.
- [ ] Evidence helper tests cover cross-workspace denial, missing anchor,
      oversized page, expired context, and redaction.

### M5: Packaging And Conformance

Exit criteria:

- [ ] Extension package handoff includes provenance, attestation, compatibility,
      rollback, emergency disable, and conformance report.
- [ ] SDK conformance checks cover manifest, registry, route, nav, widget,
      command, permission, read-only scope, evidence-query, and package metadata.
- [ ] Install docs describe no manifest-driven imports, no egress allowlists,
      and no direct system-of-record calls.

### M6: Release Gate

Exit criteria:

- [ ] Regression matrix covers activation, denial, quarantine, emergency
      disable, route import suppression, widget degradation, command denial,
      evidence-query boundary denial, and egress denial.
- [ ] One neutral extension package passes the conformance suite.
- [ ] Public SDK docs stay generic and contain no tenant-specific examples.

## 9. Decision Gates

**DG-1: Contract Gate**

Proceed only when ADR-0145, SDK docs, and install docs agree on manifest,
permission, read-only scope, evidence-query, packaging, and host responsibility
boundaries.

**DG-2: Import Boundary Gate**

Proceed only when direct `/external/` visits to disabled or unauthorized routes
do not import extension route code.

**DG-3: Evidence Boundary Gate**

Proceed only when extension evidence helpers reject unanchored, cross-workspace,
oversized, not-redacted, and privacy-ineligible queries.

**DG-4: Lifecycle Gate**

Proceed only when quarantine and emergency disable suppress route, nav, widget,
command, shortcut, search, background data loading, and direct deep-link access.

## 10. Risks

| Risk                                          | Impact                           | Mitigation                                                                           |
| --------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| Manifest grows into an authority source       | Permissions become hard to audit | Keep manifest descriptive and derive effective grants only from control plane        |
| Widgets create hidden background data paths   | Evidence or privacy leakage      | Use host slots, host data helpers, refresh constraints, and guard revalidation       |
| Scope names drift across packages             | Inconsistent authorization       | Maintain a read-only scope registry and versioned compatibility policy               |
| Evidence queries become too broad             | Audit and privacy risk           | Require anchors, page limits, privacy classes, redaction, and denial tests           |
| Package provenance is skipped for local speed | Supply-chain gap                 | Keep local packages allowed only as reviewed workspace links with conformance output |

## 11. Verification Plan

For documentation-only changes:

```bash
npm run docs:lint
```

For implementation follow-up:

```bash
npm run cockpit:build
node scripts/ci/check-cockpit-extension-egress.mjs
node node_modules/vitest/vitest.mjs run apps/cockpit/src/lib/extensions apps/cockpit/src/components/cockpit/extensions apps/cockpit/src/routes/external
```

## 12. Open Questions

- Should read-only scope names be centralized in the SDK package or generated
  from the control-plane OpenAPI contract?
- Which widget slots are stable enough for third-party package authors in v1?
- Should evidence-query redaction profiles be coarse built-ins or versioned
  policy outputs?
- What level of attestation is required before external package distribution:
  package digest only, SLSA provenance, or signed bundle plus SBOM?
