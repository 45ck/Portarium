# ADR-0140: Mission Control Integration Strategy

**Beads:** bead-0967, bead-1049, bead-1051, bead-1054
**Status:** Accepted
**Date:** 2026-04-30

## Context

Portarium Cockpit is the operator UI for governed agent work. It must preserve
the Portarium control-plane model: workspace tenancy, policy evaluation,
approval routing, evidence integrity, run recovery, and auditability stay
authoritative in Portarium.

Two external research tracks informed this decision:

- `mission-control-ui` provides a mission-centered operator experience with
  strong visual status cues, mission stages, evidence cards, escalation
  options, agent sessions, and artifacts.
- `t3code` provides a coding-agent runtime UI with provider adapters,
  proposed plans, checkpointing, WebSocket events, approval requests, and
  multiple agent backends.

The architectural question is whether Portarium should absorb these systems as
UI and runtime primitives, run them as standalone skins, or replace/augment its
current governance engine with their orchestration patterns.

## Drivers

- Keep Cockpit as one operator surface, not multiple competing consoles.
- Keep Portarium policy, approval, evidence, and tenancy models authoritative.
- Reuse useful visual and runtime ideas without importing incompatible domain
  semantics.
- Preserve immutable evidence and pre-execution governance for all agent
  actions.
- Leave a clean path for future extension-host work without making plugins a
  governance bypass.

## Options Considered

| Option | Summary                                                                  | Fit    | Risk   | Decision                                                   |
| ------ | ------------------------------------------------------------------------ | ------ | ------ | ---------------------------------------------------------- |
| A      | Absorb selected `mission-control-ui` concepts into Cockpit               | High   | Medium | Selected                                                   |
| B      | Treat `mission-control-ui` as a standalone Portarium skin                | Medium | High   | Rejected                                                   |
| C      | Replace or deeply augment Portarium orchestration with `t3code` patterns | Medium | High   | Rejected as replacement; selected only as adapter guidance |

### Option A: Selective Cockpit Absorption

Portarium keeps Cockpit as the reference operator UI, then absorbs the useful
`mission-control-ui` concepts as optional visual and interaction patterns:

- mission-style status density for runs and operator queues,
- risk, scope, and verification cues,
- escalation as an overlay instead of a lifecycle stage,
- artifact and evidence-focused review panels,
- optional theme primitives where they improve operator clarity.

This option preserves Portarium vocabulary and control-plane semantics while
giving Cockpit a richer operating posture.

### Option B: Standalone Skin

Portarium could ship `mission-control-ui` as a parallel skin or separate
console. This might accelerate a demo, but it would split operator attention,
duplicate routing and state, and make it unclear which surface is authoritative
for approvals, evidence, and recovery.

Rejected because the product needs a single governed operating surface.

### Option C: T3 Code Orchestration Replacement

Portarium could replace or deeply reshape its agent orchestration around
`t3code` concepts such as Effect services, provider adapters, event-sourced
threads, proposed plans, checkpoints, and WebSocket-driven runtimes.

Rejected as a replacement because Portarium already owns the governance
contract. `t3code` patterns are valuable as integration guidance:

- provider adapter proxying can wrap agent tool calls through Portarium,
- proposed plans can map into Portarium run plans,
- checkpoints can become evidence artifacts,
- runtime events can feed Portarium telemetry or CloudEvents,
- external coding-agent UIs can remain execution clients instead of replacing
  Cockpit.

## Decision

Adopt Option A and a constrained part of Option C.

Cockpit remains the Portarium-native operator surface. `mission-control-ui`
concepts may be absorbed into Cockpit when they clarify operator work, but they
must map to Portarium objects and not create a second product shell.

`t3code` is not a replacement runtime or control plane. Its strongest patterns
should influence adapter design and future execution-client integrations. A
coding-agent client can integrate with Portarium through a governance adapter
that calls Portarium before tool execution, records evidence, and waits for
approval when policy requires it.

Future plugin or extension work must use the Cockpit extension-host model
rather than direct route forks or arbitrary browser-loaded code.

## Domain Reconciliation

| External concept     | Portarium mapping                                                              | Decision                                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MCU Mission          | Run plus Work Item and Plan context                                            | Do not add a separate Mission aggregate in core. Use mission-style framing as presentation metadata where useful; goal, scope boundary, risks, acceptance criteria, and semantic summaries are candidate Run-charter projection fields. |
| MCU Stage            | Run lifecycle, Plan status, Approval status, and intervention state            | Do not copy `plan/execute/review/escalation` as a single state machine. Keep escalation orthogonal.                                                                                                                                     |
| MCU Evidence         | EvidenceEntry and Evidence Artifact                                            | Preserve Portarium hash-chain evidence. MCU evidence cards can be presentation blocks over immutable evidence.                                                                                                                          |
| MCU Escalation       | Approval feedback, request changes, handoff, freeze, and intervention controls | Model escalation as an overlay or linked decision, not as a lifecycle phase.                                                                                                                                                            |
| MCU EscalationOption | Structured operator decision options                                           | Candidate future extension for approval feedback taxonomy, but not required for core governance.                                                                                                                                        |
| MCU AgentSession     | Run actor, MachineInvocation, and agent runtime telemetry                      | Use as UI grouping for activity, tokens, cost, and semantic summaries when data exists.                                                                                                                                                 |
| MCU Artifact         | DerivedArtifact and evidence attachments                                       | Keep artifacts tied to run/evidence provenance.                                                                                                                                                                                         |
| MCU Workflow         | Project, Work Item grouping, or Run collection                                 | Use existing Portarium grouping concepts before adding new workflow entities.                                                                                                                                                           |
| T3 Thread            | Run or execution-client session                                                | Treat as external runtime state, not Portarium truth.                                                                                                                                                                                   |
| T3 ProposedPlan      | Portarium Plan and approval packet                                             | Plans can be ingested, reviewed, and evidenced before implementation.                                                                                                                                                                   |
| T3 Checkpoint        | Evidence Artifact                                                              | Checkpoints can be captured as immutable evidence, not mutable recovery truth.                                                                                                                                                          |
| T3 ProviderAdapter   | Machine/runtime adapter                                                        | Use adapter proxying to enforce Portarium policy before side effects.                                                                                                                                                                   |
| T3 request.opened    | AgentActionProposal and Approval                                               | Portarium remains authoritative for decision and evidence.                                                                                                                                                                              |

## Migration Path

1. Document the operator model mapping.
   - Keep this ADR as the decision record.
   - Keep `docs/internal/ui/cockpit/mission-control-convergence.md` as the
     product direction note.

2. Absorb visual and interaction primitives selectively.
   - Start with optional Cockpit theme and status-density patterns.
   - Prefer presentation components over new core aggregates.
   - Do not alter approval, run, policy, or evidence semantics for styling.

3. Integrate coding-agent runtimes through governed adapters.
   - Wrap provider or tool-call boundaries with Portarium
     Propose/Approve/Execute.
   - Convert proposed plans and checkpoints into Portarium plans and evidence.
   - Treat checkpoint diffs, transcripts, token usage, cost, and semantic
     summaries as supplemental run or evidence metadata when they carry stable
     source identity.
   - Treat runtime UI approval prompts as mirrors of Portarium state, not the
     source of authority.

4. Use Cockpit extension hosting for non-core surfaces.
   - Domain-specific dashboards and operator cards belong in extension packages
     once the host, activation, guard, egress, and regression beads are closed.
   - Core Cockpit remains usable with no external extensions installed.

## Governance Rules

- Portarium policy evaluation happens before side effects.
- Portarium approvals and evidence remain authoritative even when an external
  runtime UI displays a local approval prompt.
- Evidence from external runtimes must be normalized into Portarium evidence
  entries or artifacts before it is used for operator decisions.
- Imported events and artifacts must carry workspace, run, actor, source-system,
  correlation, and external-reference metadata before they are eligible for
  audit-grade evidence.
- External artifacts that cannot be canonicalized or linked to provenance must
  be marked as unverified and must not satisfy governance decisions that require
  complete evidence.
- Extension or generated UI surfaces can request actions only through governed
  Portarium APIs.
- Client-side visual state never grants authority; server-issued workspace,
  role, capability, and API-scope context controls access.
- All externally initiated side effects must still travel through the
  Portarium control plane, matching the all-roads-through-control-plane
  enforcement posture.
- Plans, diffs, checkpoints, transcripts, and artifacts used for human review
  must remain truth-preserving evidence inputs, not mutable runtime assertions.
- Portarium remains the only authority for `NeedsApproval`, `Approved`,
  `Denied`, `RequestChanges`, and `Executed` state. Runtime-local approval
  prompts may mirror those states but must not finalize them.
- Browser clients, embedded previews, and extension routes must call only
  same-origin Portarium APIs or explicitly mediated backend endpoints. They
  must not receive credential values or call systems of record directly.

## Non-Goals

- Do not fork `mission-control-ui` into a second Cockpit product.
- Do not replace Portarium orchestration or governance with `t3code`.
- Do not copy external source code without a separate licensing decision.
- Do not add a new Mission aggregate to Portarium core as part of this ADR.
- Do not allow plugins, skins, or generated surfaces to bypass approval,
  evidence, policy, tenancy, egress, or audit controls.
- Do not load arbitrary remote JavaScript for Cockpit operator surfaces.

## Consequences

Positive:

- Cockpit can become more operator-dense and useful without losing Portarium
  semantics.
- Mission-control concepts become reusable presentation and interaction
  patterns rather than a parallel domain.
- Coding-agent runtimes can integrate through governed adapter boundaries.
- The plugin-extensibility path remains compatible with ADR-0126.

Negative:

- Selective absorption is slower than copying a full external UI.
- Some MCU concepts, such as structured escalation options and risk annotations,
  need separate product and domain work before becoming first-class.
- External runtime integrations still require adapter implementation and
  evidence normalization.

## Implementation Mapping

- `bead-0967`: this ADR.
- `bead-1049`: plugin-extensibility architecture that builds on this decision.
- `bead-1051`: optional Cockpit mission-control shell and theme convergence.
- `bead-1054`: operator-plugin host implementation.
- `bead-1114` through `bead-1123`: Cockpit extension host contract,
  activation, guard, projection, package, egress, test, and SDK work.

## Acceptance Evidence

- Research: `docs/internal/research/mission-control-ui-domain-model.md`
- Research: `docs/internal/research/t3code-architecture.md`
- Product direction:
  `docs/internal/ui/cockpit/mission-control-convergence.md`
- Existing cockpit reuse decision:
  `docs/internal/adr/0078-agentic-workflow-cockpit-reuse-vs-build-strategy.md`
- Existing action governance decision:
  `docs/internal/adr/ADR-0118-agent-action-governance.md`
- Approval wait loop:
  `docs/internal/adr/ADR-0117-approval-wait-loop-mechanism.md`
- Plan truthfulness:
  `docs/internal/adr/0027-plan-objects-and-diff-truthfulness.md`
- Evidence lifecycle:
  `docs/internal/adr/0028-evidence-lifecycle-retention-privacy.md`
- Evidence integrity:
  `docs/internal/adr/0029-evidence-integrity-tamper-evident.md`
- Hybrid orchestration:
  `docs/internal/adr/0070-hybrid-orchestration-choreography-architecture.md`
- Control-plane enforcement:
  `docs/internal/adr/0073-all-roads-through-control-plane-enforcement.md`
- Cockpit extension host:
  `docs/internal/adr/ADR-0126-cockpit-extension-host.md`

## Remaining Gap Tracking

- Theme and shell convergence remain open under `bead-1051`.
- Provider-adapter proxy integration for coding-agent clients needs a future
  implementation bead before it can be treated as supported.
- Structured escalation options and explicit risk annotations need separate
  product decisions before becoming domain objects.
- Extension-host implementation remains gated by the `bead-1114` through
  `bead-1123` sequence.
