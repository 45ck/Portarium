# Policy Studio Mental-Model Audit

**Date:** 2026-04-03  
**Bead:** bead-1084  
**Evaluator lens:** `mental-model-checker` with live-screen evidence  
**Scope:** `Policy Studio` and the handoff into `Approvals` for the merged OpenClaw prototype on `main`

## Summary

The prototype is directionally right: it frames policy as a control loop instead of a raw rules table, and the handoff into a live Approval Gate is a strong product move.

The current problem is not lack of capability. The problem is that the first exploration pass asks the operator to learn too many governance concepts at once. The screen currently mixes posture, doctrine, evidence, simulation, runtime precedent, and live approval routing in one view. That makes the system feel noisy even when the underlying model is coherent.

The main gap is mental-model clarity:

- users can see many control objects
- users cannot quickly tell which object answers which question
- the same decision is described through multiple vocabularies across `Policy Studio` and `Approvals`

## Review Tasks

This audit evaluated the prototype against four exploratory tasks:

1. Understand what the selected capability actually controls.
2. Explain why the current action is `HumanApprove` instead of `Auto`, `Assisted`, or `Manual-only`.
3. Predict what a tier or evidence change would affect now versus later.
4. Handoff into the live approval and preserve enough context to make the two screens feel like one governance flow.

## Evidence

### Observed artifacts

- `qa-artifacts/hci-audit/policy-studio.png`
- `qa-artifacts/hci-audit/policy-studio.json`
- `qa-artifacts/hci-audit/approvals-from-policy-studio.png`
- `qa-artifacts/hci-audit/approvals-from-policy-studio.json`

### Screen evidence highlights

- `Policy Studio` exposes the operator loop, posture mix, runtime noise, capability matrix, selected slice editor, simulation lab, precedent conversion, and control checklist on one route.
- The main visible heading structure is shallow. The live page exposes one `H1` plus a small number of secondary headings, while much of the important hierarchy lives only in card titles and dense body text.
- `Policy Studio` renders the workspace badge as `ws-meridian`, while the linked `Approvals` surface renders `ws-demo`. Even if this is fixture-related, it weakens trust that the operator is still inside one coherent governed context.
- The approvals handoff successfully focuses `apr-oc-3201`, but the destination screen still reverts to a full triage environment with queue list, mode switches, and generic approval framing before the policy connection becomes clear.

## Findings

### F1. Too many governance layers are visible at once

**Severity:** Major

The first view collapses several distinct layers into the same visual plane:

- platform doctrine
- capability default
- evidence requirements
- scenario replay
- runtime precedent
- live approval routing

That is powerful for an expert. It is noisy for exploration because the operator has to infer which section answers which question.

**Task impact**

- Task 1 slows down because the user must scan the whole page to learn what object is being edited.
- Task 3 slows down because "draft posture" and "live impact" appear beside each other without a strong now-versus-next-time distinction.

**Design implication**

The page needs a stronger first-order explanation stack:

1. what this capability does
2. what the current default is
3. why that default exists
4. what will change if I edit it
5. which live approvals are affected

### F2. The same control decision is described through multiple vocabularies

**Severity:** Major

The operator currently has to bridge several overlapping terms:

- `capability slice`
- `posture`
- `policy`
- `platform doctrine`
- `decision path`
- `tier`
- `rule`
- `roles required`
- `SoD`

Each term is valid in isolation, but the system does not yet tell the operator how they relate.

**Observed example**

`Policy Studio` says:

- `HumanApprove`
- `Layered control system`
- `Platform doctrine`
- `Decision path`

`Approvals` says:

- `Tier: HumanApprove`
- `Rule: SOD-COMMS-001`
- `Roles required: approver`
- `SoD: Eligible`

An operator asking "why is this human-approved?" has to stitch the answer together manually.

### F3. The capability matrix starts at expert density instead of exploratory clarity

**Severity:** Major

Each row currently combines:

- family
- trigger
- systems
- sensitivity
- persistence
- tier
- evidence
- runtime noise
- owner

This is useful once the operator already trusts the model. It is heavy for first-pass comprehension because doctrine, scope, and telemetry are mixed in one row.

**Task impact**

- Task 1 becomes classification work instead of understanding work.
- Operators are more likely to scan for a familiar word than to understand the governing structure.

**Design implication**

The default row should answer the first-order questions only:

- what action family is this
- what is the current execution tier
- what systems are touched
- who owns it

Everything else should be progressive disclosure.

### F4. The policy-to-approval handoff is conceptually good but context continuity is still thin

**Severity:** Medium

The handoff itself is the right idea. The operator should be able to move from policy intent to live case review without opening an entirely different mental model.

The current implementation preserves:

- the focused approval id
- a return path back to `Policy Studio`
- a banner explaining that the case was opened from policy work

But it does not yet preserve enough policy context in the destination screen. The approvals page still foregrounds the general queue, generic triage controls, and mode tabs before restating the policy relationship.

**Task impact**

- Task 4 succeeds mechanically but not yet cognitively.
- The operator is focused on the right case, but the screen still feels like a context switch.

### F5. Execution-tier language still assumes system literacy

**Severity:** Medium

`Auto`, `Assisted`, `HumanApprove`, and `ManualOnly` are core terms, but they do not yet carry a persistent operator-facing explanation model.

The prototype often shows the badge without answering the practical question:

- who can act
- what happens next
- what evidence is required
- whether the action executes now, after approval, or never

This especially matters for exploration because `HumanApprove` and `ManualOnly` are easy to confuse if the operator does not already know Portarium semantics.

### F6. Fixture and route coherence still leaks into the operator experience

**Severity:** Medium

Two coherence issues surfaced during the audit:

- workspace identity changes between `Policy Studio` and `Approvals`
- the direct handoff link serialized `demo` in a brittle way, relying on dev mode for correct behaviour

The handoff query issue was corrected during this bead so the route now emits `demo=true` and the approvals search model accepts real boolean demo flags.

Even after that fix, the workspace mismatch remains an operator-trust problem. If the operator thinks they are inspecting one governed context and the shell claims another, the system looks less explainable than it is.

## Evidence vs Assumptions

### Directly observed

- screen text and structure from the live prototype
- link targets and query strings
- section density on the `Policy Studio` route
- the focused approval handoff behaviour
- the workspace mismatch between origin and destination views

### Inferred but not yet user-tested

- first-time operators will likely ask "what controls this?" before they ask "how do I edit this?"
- users will likely read the capability matrix row as a status table before they read it as a policy object
- the current handoff likely feels like a context switch rather than a seamless governance loop

These are strong inferences from the current UI, but they should be validated in the cognitive-friction pass rather than treated as final truth.

## Recommendations

### R1. Establish a fixed explanation order for every policy surface

Before any detailed controls, answer:

1. what this capability controls
2. what the current default is
3. why the current default exists
4. who can change it
5. what evidence is required
6. what happens to live work if it changes

### R2. Separate doctrine from telemetry in the matrix

The matrix should default to doctrine. Noise signals such as linked approvals, precedent, and runtime traffic should be secondary annotations, not primary row content.

### R3. Standardise the operator-facing vocabulary

One operator-facing term should own each concept:

- capability
- policy default
- approval route
- evidence requirement
- authority gate
- effective decision

Do not make the operator translate between `tier`, `rule`, `posture`, and `decision path` unless the screen explicitly teaches the relationship.

### R4. Make the handoff feel like one flow, not two screens

When arriving from `Policy Studio`, the approvals view should carry a persistent policy breadcrumb such as:

- selected capability
- current default
- draft change under review
- why this live case is the relevant precedent

### R5. Keep advanced governance detail available, but not first

Inheritance, break-glass, replay semantics, and platform doctrine are important. They should not be the first reading burden during exploration.

## Recommended Next Step

Proceed to:

- `bead-1085` for the cognitive-friction and navigation-cost pass
- `bead-1086` for the terminology and progressive-disclosure model

This audit says the model is worth keeping. The next work should make it easier to understand without flattening the governance power that makes the product distinct.
