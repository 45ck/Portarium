# Cockpit Policy Clarity Pass v1

**Status:** Proposed  
**Related Beads:** bead-1086, bead-1088, bead-1089, bead-1090  
**Extends:** [Cockpit Policy Authoring and Simulation v1](./cockpit-policy-authoring-and-simulation-v1.md)

## Purpose

Turn the April 3 heuristic review into a concrete clarity pass for the current Cockpit prototype so operators can understand the policy-to-approval loop without prior Portarium training.

This is not a new policy feature set. It is a comprehension and task-focus pass on the existing prototype.

## Problem Statement

The current prototype exposes too much of the internal governance model before the operator has a stable mental model.

Observed problems from the screen review:

- `Policy Studio` presents overview, doctrine, precedent, matrix, draft editing, and approval handoff at once.
- the page does not establish a single primary task
- important distinctions such as `this live case` vs `future policy effect` are implied instead of explicit
- internal labels such as `slice`, `posture`, and `precedent` increase learning burden
- the policy-linked approval view is more concrete, but the immediate decision path is still visually subordinate to dense governance metadata

## Design Goal

The operator should be able to answer these questions within a few seconds on each page.

### Policy Studio

1. What live case am I looking at?
2. What policy am I drafting from that case?
3. What changes for this case now?
4. What changes for similar future cases later?
5. What evidence and authority are required before I publish the draft?

### Policy-linked approval review

1. Why am I being asked to decide this case now?
2. What decision is needed from me?
3. What is the blast radius if I approve?
4. What evidence is sufficient?
5. Where do I go back when I am done?

## Scope

- policy authoring clarity cues in `Policy Studio`
- explicit time-horizon framing between live approval context and future Policy changes
- terminology and hierarchy adjustments inside the existing prototype
- a focused approval review mode when the operator enters from `Policy Studio`
- test updates and screenshot-based review evidence for the revised flow

## Out of Scope

- replacing the core policy matrix with a different interaction model
- full policy simulation redesign
- new backend contracts
- deeper role or authority model work already tracked under upstream governance beads

## Working Principles

### P1 Primary task first

Each screen must establish one main operator job before showing surrounding governance detail.

### P2 Time horizon must be explicit

The UI must differentiate:

- current live approval needing a decision now
- draft policy configuration not yet published
- future impact on similar cases

### P3 Concrete case before abstract doctrine

When the operator arrives from a live approval, the page should anchor first on the case that motivated the draft, then show how the doctrine changes.

### P4 Plain-language default

Use Portarium-correct language, but prefer operator-facing labels that explain the concept without requiring glossary lookup.

### P5 Deep detail on demand

Advanced governance detail should remain available, but not as the default reading burden.

## Screen-Level Plan

## A. Policy Studio clarity pass

### A1 Establish a visible working context

Add a top-level context panel that states:

- the live approval that triggered this draft
- the currently selected policy area
- whether the operator is editing `this draft` or reviewing the `published default`

### A2 Make the time horizon explicit

Add a visible split between:

- `Decide this live case`
- `Change future policy`

The current prototype implies this through layout. The revised version should state it directly.

### A3 Reduce abstract metric load

Demote or relabel summary tiles that require insider decoding.

Examples:

- replace ratio-only summary like `1/0/4/2` with named tier counts
- relabel `Noisy slices` to a plainer phrase such as `Approval hotspots`
- relabel `Pending precedents` to a plainer phrase such as `Recent decisions shaping policy`

### A4 Keep the matrix, but narrow the reading burden

The matrix should remain the main doctrine surface, but the surrounding copy should clarify:

- what row is active
- which fields are draft edits
- which evidence items are already required by policy
- which evidence items are being added or removed in the draft

### A5 Preserve the handoff

The `Open in triage deck` path remains, but the handoff card should describe:

- why that live case still needs judgment
- what the draft is expected to change if later published

## B. Policy-linked approval review mode

### B1 Add a focused entry state

When the approval screen is opened from `Policy Studio`, the page should explicitly enter a focused review mode rather than presenting the same generic queue-first framing.

### B2 Bring the decision path above the fold

The first viewport should make these items immediately legible:

- what Action is proposed
- why it is gated
- the current recommendation
- the primary decision controls

### B3 Separate decision essentials from audit detail

The approval view should visually split:

- `Decide now`
- `Evidence and policy context`
- `Deep audit detail`

The current prototype mixes these layers too tightly.

### B4 Make sufficiency legible

The screen should provide a fast read on whether the evidence packet is complete enough for routine decision-making, without forcing raw-log archaeology.

### B5 Preserve return navigation

The return path back to `Policy Studio` must remain explicit and must preserve the draft state.

## Acceptance-Driven Delivery Slices

### Slice 1: terminology and hierarchy

- relabel the most confusing summary and context elements
- update route tests to assert the new labels

### Slice 2: Policy Studio context and time horizon

- add explicit live-case and future-policy framing
- make the active draft state easier to scan

### Slice 3: focused approval review

- add a focused mode for policy-linked review
- surface primary decision controls and recommendation higher in the layout

### Slice 4: review evidence

- capture updated screenshots
- run a follow-up heuristic pass against the revised screens

## Test Focus

- route rendering for `/config/policies`
- route rendering for `/approvals?demo=true&from=policy-studio&focus=...`
- preservation of round-trip draft state
- presence of explicit context, time-horizon, and return cues
- policy-linked review behavior does not break generic approvals flow

## Risks

- over-correcting into oversimplified copy that loses Portarium precision
- introducing a second approval mode that diverges from the main triage model
- moving critical metadata below the fold without an alternate strong summary

## Open Questions

- which operator-facing terms should remain Portarium-native even if they are initially harder to learn
- whether the focused approval view should be a distinct mode label or just a layout variant
- how far to go on renaming labels before the upstream terminology bead is complete

## Completion Criteria

- the clarity pass is implemented in the prototype
- route tests cover the new cues
- screenshots are captured for both pages after the change
- the follow-up review can explain the improved mental model in concrete terms
