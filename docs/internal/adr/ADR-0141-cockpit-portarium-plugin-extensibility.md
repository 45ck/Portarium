# ADR-0141: Cockpit And Portarium Plugin Extensibility

**Beads:** bead-1049, bead-1054, bead-1055, bead-1062, bead-1114, bead-1115, bead-1116, bead-1117, bead-1118, bead-1119, bead-1120, bead-1121, bead-1122, bead-1123
**Status:** Accepted
**Date:** 2026-04-30

## Context

ADR-024 kept the door open for a plugin-friendly portal posture. That posture
now needs a concrete model because Cockpit is becoming the primary operator
surface for governed agent work, while Portarium must remain the authoritative
control plane for policy, approvals, evidence, tenancy, and side-effectful
commands.

ADR-0140 decides that `mission-control-ui` concepts fold into Cockpit rather
than creating a second operator console, and that `t3code`-style runtime
patterns are adapter guidance rather than a replacement control plane.

ADR-0126 already decides the narrow v1 Cockpit route-host shape: compile-time
installed UI packages, host-owned imports, `/external/` routes, server-issued
activation context, same-origin or mediated API calls, and no remote browser
JavaScript.

This ADR defines the broader plugin and operator-surface extensibility model
that those decisions fit inside.

## Drivers

- Keep Cockpit as one coherent operator surface.
- Keep Portarium core generic and tenant-neutral.
- Allow customer, domain, and workflow-specific operator surfaces without
  hardcoding them into Cockpit core.
- Let agents suggest useful surfaces without turning generated UI into arbitrary
  executable code.
- Preserve policy, approval, evidence, tenancy, credential, and egress
  boundaries for every extension path.
- Provide a migration path from deferred ADR-024 to typed manifests, guarded
  routes, governed data access, and lifecycle controls.

## Options Considered

| Option | Summary                                                | Decision        |
| ------ | ------------------------------------------------------ | --------------- |
| A      | Hardcode every domain/operator screen in Cockpit core  | Rejected        |
| B      | Run a separate Backstage-style portal beside Cockpit   | Rejected        |
| C      | Allow runtime remote UI plugins or marketplace bundles | Rejected for v1 |
| D      | Use a layered, host-governed extension model           | Selected        |

### Option A: Hardcoded Core Screens

Hardcoding every operator surface in Cockpit core is simple for the first
workflow, but it makes Portarium tenant- and domain-specific. It also makes
Macquarie-style, education-style, growth-studio-style, and future vertical
surfaces indistinguishable from generic product code.

Rejected because it does not scale and weakens the generic platform boundary.

### Option B: Separate Plugin Portal

A separate portal could mimic the Backstage pattern from ADR-024, but it would
split operator attention and make it unclear whether Cockpit or the portal owns
approvals, evidence packets, run status, and intervention controls.

Rejected because ADR-0140 requires one Cockpit operator experience.

### Option C: Runtime Remote Plugins

Remote plugin bundles or manifest-driven JavaScript imports would make
extension rollout flexible, but they expand the browser trust boundary before
permission grants, egress, signing, quarantine, and audit controls are mature.

Rejected for v1. A future marketplace can be reconsidered only after the host,
egress, signing, lifecycle, and conformance suite are proven.

### Option D: Layered Host-Governed Extensions

Use a layered model:

- Cockpit renders approved operator surfaces through host-owned extension
  points.
- Portarium issues activation, permission, data, command, and lifecycle truth.
- Extension packages declare metadata and presentation code, but do not own
  secrets, approval state, policy, or direct system-of-record access.
- Agent-generated surfaces use structured schemas and evidence-linked proposals,
  not arbitrary browser-executable code.
- Agent runtime plugins intercept execution and route actions through
  Portarium, but do not become approval authorities.

Selected because it turns ADR-024 into a concrete model while preserving
Portarium governance.

## Decision

Adopt the layered host-governed extension model.

Portarium extensibility has four lanes:

1. **Declarative vertical packs**
   - Versioned configuration for schemas, workflows, mappings, policy defaults,
     and template metadata.
   - No arbitrary browser code.

2. **Cockpit extension packages**
   - Build-time installed UI packages that contribute routes, navigation,
     commands, shortcuts, view components, and declared data needs.
   - Governed by ADR-0126 for the v1 executable browser boundary.

3. **Runtime and adapter plugins**
   - Execution-side hooks, provider adapters, gateway plugins, or sidecars that
     call Portarium before side effects.
   - They may propose actions, wait for approvals, and report evidence, but
     cannot approve or execute outside Portarium authority.

4. **Generated operator surfaces**
   - Agent-proposed cards, forms, panels, summaries, and review packets
     represented as structured data.

- They can render only through host-approved schemas/components and must attach
  to a Run, Approval, Plan, Work Item, Policy version, or Evidence Artifact.

The word "plugin" is therefore not a single runtime mechanism. It is an
umbrella for governed extension contracts at different layers.

## Ownership Model

| Layer                     | Owns                                                                                                                                                | Must not own                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Cockpit                   | Shell, routes, layout, rendering, navigation projection, command palette, mobile/desktop UX, route host fallbacks                                   | Policy truth, approval finality, secrets, direct system-of-record access                    |
| Portarium control plane   | Workspace activation, extension grants, API scopes, capabilities, lifecycle state, quarantine, approval, policy, evidence, audit, governed commands | Browser route implementation details or tenant-specific presentation code                   |
| Extension package         | Manifest, route components, local presentation logic, declared data needs, declared commands, neutral capability/API-scope requirements             | Credentials, egress expansion, approval state machine, policy evaluation, unmanaged imports |
| Runtime plugin or adapter | Tool-call interception, proposal submission, approval polling, execution telemetry, sandbox hints                                                   | Approval authority, evidence finality, credential minting outside Portarium                 |
| Generated surface         | Structured proposal data, suggested fields, rationale, evidence references, operator task framing                                                   | Executable code, hidden authority changes, direct commands, unreviewed persistence          |

## Contract Model

### Manifest Contract

An operator-surface manifest must declare:

- stable manifest ID, owner, version, and display name,
- activated pack IDs or activation keys,
- route, nav, command, shortcut, and persona metadata,
- required capabilities and API scopes,
- guard metadata for every surfaced route and command,
- privacy class and evidence expectations for data shown,
- data-query needs through Portarium APIs or mediated backend endpoints,
- governed action intents that the surface may request,
- install and runtime compatibility metadata,
- support, disable, and rollback notes.

The manifest is descriptive. It cannot grant permissions, import code, expand
browser egress, expose credentials, include raw HTML or executable event
payloads, declare secret references, or override policy.

### Permission Contract

The contract separates:

- **Capabilities:** what the operator/workspace is allowed to see or reason
  about.
- **API scopes:** what the Cockpit client may call through Portarium APIs.
- **Action authority:** what a user, agent, or runtime may request through
  governed commands.
- **Policy result:** whether a requested action is allowed, denied, or requires
  approval.

Extensions may require capabilities and API scopes, but Portarium grants the
effective values from authenticated workspace context. Missing or unknown values
fail closed.

Privacy class is part of the effective access decision. Manifest-declared
privacy classes are not decorative metadata; downstream guard work must enforce
them from server-issued workspace and role context before sensitive surfaces are
shown or route code is imported.

### Data Contract

Extension UI reads data through:

- same-origin Portarium APIs,
- typed control-plane queries,
- explicitly mediated backend-for-frontend endpoints,
- evidence/artifact references that Portarium canonicalized.

Extension UI must not call systems of record, vaults, provider APIs, gateway
management APIs, or runtime daemon endpoints directly from the browser.
Missing, expired, or indeterminate egress policy fails closed and suppresses
route activation, background fetches, and embedded preview execution.

### Action Contract

Extensions do not execute side effects. They request governed actions:

1. The surface submits a typed command or action proposal to Portarium.
2. Portarium authenticates workspace scope and principal authority.
3. Portarium evaluates policy and SoD.
4. Portarium records evidence.
5. Portarium returns allow, deny, or needs-approval.
6. Execution happens only through approved control-plane or runtime adapter
   paths.

Commands, shortcuts, and generated forms must therefore be request-action
surfaces, not privileged execution channels.

## Generated Surface Rules

Agent-generated or agent-selected surfaces are allowed only as governed
structured data.

They must:

- use host-approved schemas or components,
- include provenance, run/work-item/approval/evidence references, and source
  agent identity,
- declare whether the proposed input is context-only, current-run effect, or
  future-policy effect,
- be sanitized and size-bounded before rendering,
- record when they are proposed, rendered, used, ignored, or disabled.

They must not:

- ship executable JavaScript, HTML event handlers, unsafe links, or active
  browser payloads,
- widen authority or permissions,
- create hidden data access paths,
- finalize approvals or run interventions locally.

## Lifecycle And Governance

Portarium owns lifecycle truth:

- install candidate,
- reviewed and build-time installed,
- workspace enabled,
- workspace disabled,
- degraded or dependency-unavailable,
- quarantined,
- superseded,
- removed.

Every lifecycle transition must be attributable and audit-ready. Quarantine and
emergency disable must suppress routes, navigation, commands, shortcuts, and
data loading from the same resolved state.

Install, activation, denial, quarantine, approval, execution, egress denial, and
contract-violation events must emit structured evidence with workspace,
principal, extension, route or command, and correlation identifiers. Evidence
must redact secrets and unsafe untrusted payloads by default.

Version pinning, signing or attestation, package provenance, compatibility
checks, and conformance tests are required before broader customer-facing
extension rollout. ADR-0126 remains the v1 implementation slice until those
controls mature.

## Migration Path

1. Treat ADR-024 as resolved by this ADR for operator-surface extensibility.
2. Use ADR-0126 as the v1 Cockpit route-host constraint.
3. Implement the generic manifest and installed registry seam under
   `bead-1114`.
4. Add compile-time route hosting, activation resolution, host guards, shell
   projection, install boundaries, browser egress checks, and regression tests
   through `bead-1115` through `bead-1122`.
5. Keep one neutral reference extension as the smoke path under `bead-1119`.
6. Implement the broader operator-plugin host under `bead-1054`.
7. Add plugin security and lifecycle controls under `bead-1062`.
8. Add generated operator card/form proposals under `bead-1055` only after the
   host and lifecycle model are stable.
9. Graduate a reusable SDK and conformance suite under `bead-1123`.
10. Move runtime plugins and adapters through the existing governance migration
    phases: visibility, credential relocation, routing by default, and
    deny-by-default enforcement.

## Non-Goals

- No second authoritative operator portal beside Cockpit.
- No tenant-specific references in Portarium generic extension code or docs.
- No runtime remote JavaScript plugins for v1.
- No manifest-driven imports.
- No browser-side secret resolution or direct system-of-record access.
- No plugin-owned approval, policy, evidence, or execution state machine.
- No generated executable UI.
- No plugin path that bypasses Policy, Approval, Evidence, SoD, tenancy, egress,
  or audit controls.

## Consequences

Positive:

- Portarium can support highly tailored operator surfaces without hardcoding
  customer or vertical logic into core.
- Cockpit remains the single operator console.
- Plugin capabilities are explainable, governed, and auditable.
- ADR-0126 implementation work has a broader architectural home.

Negative:

- v1 extension installation requires a Cockpit build.
- Runtime marketplace behavior is deferred.
- Extension authors must learn Portarium capabilities, API scopes, evidence,
  and action semantics.
- Generated surfaces require schema and rendering governance before they become
  useful at scale.

## Implementation Mapping

- `bead-1049`: this ADR.
- `bead-1054`: platform operator-plugin host.
- `bead-1055`: governed agent-generated operator cards and forms.
- `bead-1062`: operator-plugin governance controls.
- `bead-1114`: generic Cockpit extension contract and installed registry seam.
- `bead-1115` through `bead-1122`: v1 route host, activation, guard,
  projection, package, egress, and regression work.
- `bead-1123`: extension SDK and conformance graduation.

## Acceptance Evidence

- Deferred source decision: `docs/internal/ADRs-v0.md` ADR-024.
- Mission-control integration: `docs/internal/adr/ADR-0140-mission-control-integration.md`.
- Cockpit v1 route host: `docs/internal/adr/ADR-0126-cockpit-extension-host.md`.
- External package handoff: `docs/how-to/install-cockpit-extension-package.md`.
- Operator model: `.specify/specs/operator-interaction-model-v1.md`.
- Cockpit presentation contract: `.specify/specs/presentation-layer-reference-cockpit-v1.md`.
- Agent traffic controller: `docs/explanation/agent-traffic-controller.md`.
- Runtime governance migration:
  `docs/internal/governance/migration-phase-1-visibility.md`,
  `docs/internal/governance/migration-phase-2-credential-relocation.md`,
  `docs/internal/governance/migration-phase-3-routing-default.md`, and
  `docs/internal/governance/migration-phase-4-enforcement.md`.

## Remaining Gap Tracking

- Host, activation, guard, projection, and egress implementation remain open in
  the `bead-1114` through `bead-1122` sequence.
- Lifecycle controls such as signing, attestation, version pinning, emergency
  disable, and audit trail need `bead-1062`.
- Manifest privacy-class enforcement is not complete until host guards use the
  declared `privacyClasses` from route metadata in the same decision path as
  personas, capabilities, API scopes, activation, and quarantine.
- Browser egress is not production-ready until denied-origin enforcement is
  tested and missing policy fails closed before any extension fetch or preview.
- Generated surface proposal schemas need `bead-1055`.
- Runtime marketplace behavior is explicitly deferred until SDK/conformance work
  proves the v1 host model.
