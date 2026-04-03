# Policy Studio Cognitive-Friction Review

**Date:** 2026-04-03  
**Bead:** bead-1085  
**Evaluator lens:** `cognitive-friction-detector` with live-flow evidence  
**Scope:** `Policy Studio` and the policy-linked `Approvals` handoff for the OpenClaw demo flow on `main`

## Summary

The prototype has the right product idea: policy authoring, runtime precedent, and live approval review are connected into one operator loop instead of being separate admin surfaces.

The main friction problem is not that the flow lacks information. It is that the operator must carry too much of the workflow state in their own head while moving between panels and screens. The current prototype creates avoidable memory load in three ways:

- cross-panel selections change more of the page than the UI clearly signals
- the difference between "change this draft" and "affect live work now" is still easy to misread
- the return path from live approval review drops staged policy state instead of preserving it

That means the current flow can feel powerful on first read but brittle once the operator actually tries to move between policy authoring and live review.

## Review Tasks

This review evaluated the prototype against four task flows:

1. Start on `Policy Studio` and identify the current capability, execution tier, and live case linked to the draft.
2. Use runtime precedent to stage a doctrine change and determine what changed in the draft versus what changed in live execution.
3. Handoff into the focused approvals deck, inspect the live case, and return to `Policy Studio`.
4. Determine whether the current UI supports confident policy refinement or encourages shallow scanning and rework.

## Evidence

### Observed artifacts

- `qa-artifacts/hci-friction/step-1-policy-studio-home.png`
- `qa-artifacts/hci-friction/step-2-selected-precedent.png`
- `qa-artifacts/hci-friction/step-3-applied-precedent.png`
- `qa-artifacts/hci-friction/step-4-approvals-handoff.png`
- `qa-artifacts/hci-friction/friction-steps.json`

### Direct browser checks

- The initial `Policy Studio` view renders `External Email Approval` with `Draft unchanged`.
- Applying `Persistent cron creation request` changes the top-of-page working slice to `Persistent Automation Creation Block` and changes the stage from `Draft unchanged` to `Draft staged`.
- The live handoff focuses `apr-oc-3205` correctly in `Approvals`.
- Returning with `Back to Policy Studio` resets the screen to `External Email Approval` with `Draft unchanged` instead of preserving the staged cron-policy draft.

## Findings

### F1. The return path drops staged policy state

**Severity:** Critical  
**Type:** Control-model + navigation

This is the clearest friction break in the prototype.

Observed behaviour:

- stage a draft change from runtime precedent
- open the focused live approval
- return to `Policy Studio`
- the page resets to the default `External Email Approval` slice with `Draft unchanged`

That means the operator has to remember:

- which precedent they were evaluating
- which capability slice it changed
- what doctrine they staged
- whether the prior draft differed from the default

This is not just inconvenient. It breaks the claim that the operator can "go to live review and come back to tighten or relax the rule based on what they learn."

**Task impact**

- Task 3 fails cognitively even though it succeeds mechanically.
- Task 4 becomes repetitive because the operator must restage work after each live review loop.

**Design implication**

The handoff needs draft persistence, not just a generic back link. At minimum the return path should preserve:

- selected capability
- staged doctrine state
- selected precedent
- staged rationale

### F2. Runtime precedent selection silently rebinds the whole authoring surface

**Severity:** Major  
**Type:** Information architecture + hidden state

Selecting a precedent does more than choose a note from a list. It changes the working capability slice, execution tier, linked live approval, and evidence posture shown in the top summary.

That coupling is powerful, but it is not explained clearly enough before it happens. The operator is effectively switching the whole "current object of work" from email policy to persistent automation policy through a secondary list on the lower half of the page.

The UI currently requires the operator to infer that:

- the selected precedent is not only commentary
- it is also a capability-switching control
- `Apply to draft` mutates the upper-stage doctrine panel, not just the precedent card

**Task impact**

- Task 2 depends on remembering the previous capability state.
- Operators may misread the screen as "editing current policy details" when they are actually jumping to a different policy slice.

**Design implication**

If precedent selection changes the active policy slice, the page needs a stronger state-change cue:

- explicit "working on" breadcrumb
- clearer selection highlight
- before/after explanation of what changed

### F3. The page layout creates long-distance scanning between cause and effect

**Severity:** Major  
**Type:** Information architecture

The operator must visually travel across the page to relate:

- capability matrix row
- selected slice detail panel
- simulation lab
- runtime precedent list
- selected precedent detail
- operator checklist

These are all relevant pieces, but they are spatially and conceptually distributed in a way that increases attention switching.

The prototype therefore asks the operator to assemble one coherent answer from several distant cards:

- what am I editing
- what changed
- why it changed
- what evidence is required
- what live case this is connected to

**Task impact**

- Task 1 is scan-heavy before it becomes understandable.
- Task 2 becomes layout work, not policy work.

**Design implication**

The default view should reduce the number of simultaneously active surfaces and make the current object of work visually central.

### F4. “Now” versus “next time” is still too easy to confuse

**Severity:** Major  
**Type:** Control model + copy

The prototype already distinguishes draft policy work from live approval work, but the interaction still asks the operator to hold the time horizon in their own head.

Examples from the current flow:

- `Apply to draft` changes policy posture for future cases
- `Open in triage deck` switches to a live case that still needs judgment
- `Live impact preview` may show `0 approvals affected` even while the page still offers a linked live case

Those states can all be correct, but they are not narrated strongly enough. An operator can reasonably ask:

- does this draft affect the case I am about to review
- is the linked approval an example, an affected case, or both
- am I changing future doctrine or deciding current execution

**Task impact**

- Task 2 and Task 3 require extra interpretation before action.
- The flow risks shallow confidence because the user sees plausible UI states without a strong causal explanation.

**Design implication**

Each action surface should declare its time horizon explicitly:

- `this draft affects future similar cases`
- `this approval decides the current case only`
- `this live case is linked as precedent, not automatically modified by the draft`

### F5. Focused approval handoff still competes with the full triage environment

**Severity:** Major  
**Type:** Information architecture

The focused handoff succeeds technically, but the destination screen still asks the operator to process:

- queue list
- filters
- deck modes
- status badges
- the focused case
- the policy-origin banner

That creates a split-attention problem. The operator arrives to review one case, but the page still reads like the full approvals workspace.

**Task impact**

- Task 3 starts with reorientation overhead.
- The operator is more likely to scan the queue or status chrome before resuming the policy loop.

**Design implication**

Policy-linked approval review should collapse incidental queue controls and foreground:

- why this case is linked to policy work
- what policy draft the operator came from
- what will happen when they go back

### F6. The most important guardrails appear after a large amount of reading

**Severity:** Medium  
**Type:** Layout + feedback timing

In the approvals deck, the operator does eventually see critical information:

- missing required role
- manual-only tier
- irreversible risk
- deny rationale requirement

But key decision controls and consequences are separated by a long briefing panel and several context cards. That makes the operator read down the page before the full action consequences are obvious.

This matters most for risky approvals because the prototype wants to support fast triage without encouraging shallow approval behaviour.

**Task impact**

- Task 3 becomes denser than necessary before the operator reaches the action point.

**Design implication**

For policy-linked cases, authority failure and required rationale should stay closer to the decision controls.

### F7. Selection state is not exposed strongly enough

**Severity:** Medium  
**Type:** Information architecture + accessibility

The review found weak state signalling in two places:

- precedent selection does not expose a strong semantic selected state
- the operator must infer the current working slice mostly from distributed content updates rather than one persistent state anchor

That increases friction for keyboard users, repeat reviewers, and anyone moving quickly between similar cases.

**Task impact**

- Task 1 and Task 2 require extra confirmation scanning.

**Design implication**

The current working slice and selected precedent should be represented with stronger selected-state cues and one stable "you are editing" label.

## Evidence vs Assumptions

### Directly observed

- the policy authoring page resets after the return trip from approvals
- precedent application changes top-of-page capability and doctrine state
- live handoff focuses the correct approval
- focused handoff still lands inside the full approvals workspace rather than a narrowed policy-review mode
- critical decision context is spread across several cards before the action controls

### Inferred but not yet user-tested

- new operators will likely mistrust the flow after the first lost-draft round trip
- operators will likely over-scan the queue on arrival because the handoff mode still visually resembles general triage
- some users will misread precedent selection as annotation rather than active object switching

These are strong inferences from the rendered prototype and navigation behaviour, but they should be validated in a directed usability session before being treated as final.

## Open Questions

- Should policy drafts persist in URL state, local session state, or an explicit saved draft object?
- Is precedent selection intended to switch the active capability slice, or only prefill recommendations for the current slice?
- Should policy-linked approval review use a reduced-focus shell that hides most queue controls until requested?
- Should `Live impact preview` distinguish `linked precedent` from `currently affected approvals` more explicitly?

## Recommendations

### R1. Preserve authoring state across the approval round trip

The operator loop is not credible until the system returns the user to the same draft they left.

### R2. Make the current object of work explicit at all times

Introduce one persistent state anchor such as:

- `Editing capability: Persistent Automation Creation Block`
- `Draft source: Persistent cron creation request`

### R3. Separate selection from mutation more clearly

Do not make one click both select precedent and silently redefine the active authoring context without a strong explanation cue.

### R4. Declare time horizon near every action

The UI should make it obvious whether the operator is:

- deciding a live case now
- staging future policy
- using a live case only as precedent

### R5. Add a policy-linked approval review mode

When entering from `Policy Studio`, reduce queue-management noise and foreground the exact policy-review thread the operator is in.

## Recommended Next Step

Proceed to `bead-1086` and turn these findings into the operator-facing explanation model:

- vocabulary
- persistence rules
- summary-versus-detail order
- state-preservation rules for the policy-to-approval loop

If a UI iteration starts before formal usability testing, the next useful design pass should focus on:

1. draft persistence
2. explicit working-context labels
3. reduced-noise focused approval mode
