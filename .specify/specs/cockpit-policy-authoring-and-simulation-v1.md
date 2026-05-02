# Cockpit Policy Authoring and Simulation v1

**Status:** Proposed  
**Related Beads:** bead-1060, bead-1068, bead-1073, bead-1074, bead-1075, bead-1078, bead-1081, bead-1086
**Extends:** [Operator Interaction Model v1](./operator-interaction-model-v1.md), [Cockpit Policy Operator Language v1](./cockpit-policy-operator-language-v1.md)

## Purpose

Define the Cockpit information architecture, interaction model, and component contract for human-authored Policy in Portarium.

The design goal is to make Policy a layered control system that organisations can operate safely, not a giant raw rules page that assumes humans think in boolean expressions first.

## Core Principle

Humans should set Policy in this order:

1. what outcomes are never acceptable
2. what classes of Actions are generally allowed
3. under what conditions they can run
4. what evidence is required
5. who must approve
6. what happens on exceptions

Cockpit should therefore feel like:

`intent -> boundary -> conditions -> evidence -> decision path`

not:

`raw rules -> giant table -> hidden consequences`

## Product Thesis

Portarium already has the right backend primitives:

- risk-aware Action evaluation
- Policy decisions of `allow`, `deny`, or `needs_approval`
- Execution Tiers of `Auto`, `Assisted`, `Human-approve`, and `Manual-only`
- evidence-linked Approval Gates

Cockpit should expose those primitives through operational controls that match how humans actually reason:

- choose defaults
- set boundaries
- react to incidents
- refine thresholds from precedent
- simulate before publishing

## Policy UX Surfaces

Cockpit policy authoring should be structured into five primary surfaces.

### A. Policy Overview

An operational posture dashboard, not a raw rule list.

Show:

- current Execution Tier posture across major capability families
- top risky capabilities
- recent denials and escalations
- recent overrides and break-glass use
- noisy approvals and drift signals
- policy ownership by area
- incidents or near misses linked back to affected Policy

Purpose:

- orient humans around current governance posture
- show where Policy is too weak, too noisy, or too ambiguous
- let a policy owner start from an operational problem instead of from a blank editor

### B. Capability Posture Matrix

The main default-setting surface.

Rows:

- capability family or exact capability
- examples: `read.*`, `write.*`, `delete.*`, `money.*`, `deploy.*`, `admin.*`

Columns:

- environment
- resource or system
- data sensitivity
- blast radius
- persistence
- Execution Tier
- allowed principals or roles
- required evidence

Purpose:

- set default posture without requiring bespoke rules for every case
- make organisational autonomy doctrine visible
- show where exceptions diverge from the default

### C. Rule Builder

A progressive-disclosure editor for conditional Policy.

Default mode:

- structured, form-based blocks
- natural-language summary rendered live
- human-readable condition groups

Advanced mode:

- DSL, JSON, policy-as-code export, or import surfaces for expert users

Purpose:

- let ordinary policy owners create strong rules without writing code
- preserve expert escape hatches without making them the primary mode

### D. Simulation and Replay Lab

A safe pre-activation path for Policy changes.

Support:

- hypothetical scenario simulation
- replay against recent governed Runs and Approvals
- side-by-side comparison of current posture vs proposed posture
- evidence of which rule matched and why

Purpose:

- prevent blind policy publication
- expose the real queue, cost, and tiering consequences of a proposed change

### E. Approval-to-Policy Loop

The runtime-to-governance feedback path.

When a human denies, narrows scope, escalates, or asks for more evidence, Cockpit should offer:

- one-off decision only
- update Policy for similar cases
- require more evidence next time
- narrow scope for this capability
- change required role
- raise tier for this class of Action
- block in this environment

Purpose:

- turn runtime exceptions into reusable governance improvements
- make precedent one of the main ways Policy evolves

## Information Architecture

### Top-level navigation

Policy should be a dedicated Cockpit area, not buried inside a dense settings page.

Recommended sections:

1. `Overview`
2. `Capability Posture`
3. `Rules`
4. `Simulation`
5. `Activity`

Optional sub-sections:

- `Ownership`
- `Overrides`
- `Incidents`

### Entry paths

Users should be able to enter policy authoring from:

- primary Policy nav
- noisy approval alerts
- denied or escalated approval detail
- incident or near-miss review
- simulation links from policy diffs

## Policy Overview Requirements

### R1 Overview cards

The landing page should summarize:

- number of capabilities in each default Execution Tier
- top noisy approval classes
- recent denials by reason
- overrides in the last 7/30 days
- policy changes awaiting review or activation
- policy areas with no active owner

### R2 Drift and noise signals

The overview must highlight:

- repetitive denials of the same Action class
- repetitive approvals with identical rationale
- recent manual overrides that suggest weak defaults
- policies producing unexpectedly high queue pressure

### R3 Ownership visibility

Every policy area should show:

- owner
- last changed by
- last reviewed at
- linked incidents or near misses
- review cadence

## Capability Posture Matrix Requirements

### R4 Matrix semantics

The posture matrix must let humans set defaults by capability family before they reach rule-level exceptions.

Each posture row must answer:

- who can trigger it
- what Action or family it covers
- where it can run
- on which systems or resources
- under what data sensitivity and blast radius
- with what required evidence
- which Execution Tier applies
- who may override or approve exceptions

### R5 Matrix behavior

The matrix should support:

- bulk editing by capability family
- filtering by environment, system, and sensitivity
- visible inheritance from higher-level policy layers
- highlight of exception rules overriding the default posture
- preset previews for common Workspace doctrines without mutating the published default
- an effective-posture explanation that shows doctrine, default, preset, and exception layers

### R6 Progressive density

The default matrix view must not dump every connector x capability x environment combination at once.

Use:

- grouped capability families
- drill-down rows
- expandable conditions
- presets and templates

## Rule Builder Requirements

### R7 Structured default mode

The default rule builder should use structured blocks:

**When**

- actor is
- action is
- system is
- environment is
- touches sensitive data
- estimated cost exceeds
- blast radius exceeds
- persistence is

**Then**

- auto allow
- require approval
- require specific role
- require extra evidence
- deny
- deny and escalate

**Require**

- rationale
- diff
- preview
- rollback plan
- cost estimate
- impacted entities list
- connector posture check

### R8 Live natural-language summary

The builder must generate a human-readable summary of the rule as the user edits it.

### R9 Advanced mode

Expert users may switch to advanced mode for:

- DSL editing
- JSON editing
- import or export
- policy-as-code review

Advanced mode must remain secondary.

## Simulation and Replay Requirements

### R10 Scenario simulation

Before activation, humans must be able to test concrete scenarios such as:

- destructive mailbox deletion
- pull-request creation on an approved repository
- creation of persistent automation

For each scenario, show:

- decision
- matched rules
- missing evidence
- required approver or queue
- effective Execution Tier
- reason path

### R11 Historical replay

The simulation lab must support replay against recent governed Runs and queued work.

Show:

- how many Actions would move between tiers
- approval volume impact
- blocked-action delta
- cost impact where available
- expiry or backlog risk where available

### R12 Diffed outcome view

The lab must compare:

- current Policy outcome
- proposed Policy outcome

using the same language as runtime Cockpit surfaces.

## Approval-to-Policy Requirements

### R13 Runtime conversion path

From an approval or denial, the UI should offer:

- `Deny once`
- `Deny and create rule`
- `Approve once`
- `Approve and loosen rule`
- `Require more evidence next time`
- `Escalate this class of Action`

### R14 Precedent-aware authoring

When converting a runtime decision into Policy, the UI should prefill:

- capability or Action family
- environment
- system touched
- evidence gap
- decision reason
- suggested rule or threshold changes

### R15 One-off vs reusable scope

Every runtime intervention intended to inform Policy must distinguish:

- one-off Run decision
- reusable policy change
- evidence requirement change
- role-routing change
- approval-tier change

### R16 Round-trip continuity

When an operator moves from Policy authoring into a focused approval review and then returns, Cockpit must preserve:

- selected capability slice
- selected runtime precedent
- selected replay scenario
- drafted Execution Tier change
- drafted evidence packet
- drafted rationale text

The return path must be explicit and typed, not dependent on transient in-memory component state.

## Policy Object Requirements

Every persisted policy object shown in Cockpit must surface:

- owner
- last changed by
- rationale
- affected capabilities
- review cadence
- linked incidents, approvals, or near misses
- current status: draft, simulated, pending approval, active, expired, superseded

## Role Model

Cockpit policy-setting rights should separate:

- `Operator`: runtime approvals and steering only
- `Approver`: authorization of risky Actions
- `Policy owner`: draft, simulate, activate, rollback, and review defaults, thresholds, evidence requirements, and policy scope
- `Domain SME`: provide domain-specific advice or approval eligibility for scoped Action classes
- `Auditor`: inspect but not mutate
- `Admin`: manage role gates, workspace posture, and platform configuration

Where small teams combine roles, the system may permit overlap, but it must not hide that overlap. The authority source and SoD status must remain visible before activation, rollback, override, or approval-to-policy conversion.

## Screen Model

### Screen 1: Policy Overview

Primary components:

- `PolicyPostureSummaryCards`
- `RiskyCapabilitiesPanel`
- `NoisyApprovalsPanel`
- `OverridesAndBreakGlassPanel`
- `PolicyOwnershipPanel`
- `PolicyIncidentFeed`

### Screen 2: Capability Posture

Primary components:

- `CapabilityPostureMatrix`
- `CapabilityFamilyFilterBar`
- `ExecutionTierCell`
- `EvidenceRequirementCell`
- `RoleRequirementCell`
- `PostureInheritanceInspector`
- `CapabilityPosturePresetSelector`
- `EffectivePostureExplanationPanel`

### Screen 3: Rule Builder

Primary components:

- `PolicyRuleEditor`
- `WhenConditionBuilder`
- `ThenDecisionBuilder`
- `RequiredEvidenceBuilder`
- `PolicySummaryPreview`
- `AdvancedPolicyEditor`

### Screen 4: Simulation Lab

Primary components:

- `PolicyScenarioRunner`
- `HistoricalReplayPanel`
- `MatchedRulesTrace`
- `DecisionPathPanel`
- `CurrentVsProposedOutcomeDiff`

### Screen 5: Approval-to-Policy Drawer

Primary components:

- `ApprovalPolicyActionDrawer`
- `DecisionReuseChooser`
- `SuggestedPolicyChangeCard`
- `ReasonToRuleMapper`
- `PrefilledRulePreview`

## Interaction Principles

### I0 Use the Policy Explanation Ladder

Policy Studio, Approvals, Simulation, and audit views must use the operator-facing
terminology and progressive-disclosure order from [Cockpit Policy Operator Language v1](./cockpit-policy-operator-language-v1.md).

The required order is:

1. current work
2. effective decision
3. required evidence and authority
4. future policy effect
5. deeper mechanics

Do not introduce new first-level labels for Policy concepts when the operator-language
spec already defines a canonical label.

### I1 Start from examples, not blankness

Use:

- presets
- templates
- example scenarios
- prior incidents
- prior denials and approvals

Avoid a blank policy canvas as the default experience.

### I2 Show consequences before commit

Any major Policy change should show:

- blast radius
- affected Runs or Workspaces
- approval queue impact
- missing ownership or review gaps

### I3 Prefer operational language

Use plain language summaries over raw jargon whenever possible.

### I4 Make policy evolution visible

Policy is not static. Cockpit should make it obvious:

- what changed
- why it changed
- what runtime event motivated it
- who approved it

### I5 Preserve operator context across surfaces

Cross-surface navigation between `Policy Studio` and `Approvals` must keep the operator in the same working thread rather than resetting them to a generic default state.

## Acceptance Signals

- policy authoring starts from operational posture rather than a giant rules table
- organisations can set default autonomy doctrine through the capability posture matrix
- complex rules are authorable through structured blocks before advanced mode is needed
- high-impact policy changes can be simulated and replayed before activation
- runtime decisions can be converted into reusable Policy without prose archaeology
- ownership, rationale, and auditability are explicit on every meaningful Policy object

## Traceability Links

- [docs/explanation/agent-traffic-controller.md](../../docs/explanation/agent-traffic-controller.md)
- [README.md](../../README.md)
- [docs/internal/ui/cockpit/governance-policy-design.md](../../docs/internal/ui/cockpit/governance-policy-design.md)
- [Operator Interaction Model v1](./operator-interaction-model-v1.md)
- [Cockpit Policy Operator Language v1](./cockpit-policy-operator-language-v1.md)
