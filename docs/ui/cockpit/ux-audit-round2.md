# UX Audit Report (Round 2): Portarium Cockpit Lo-Fi Prototype

**Date:** 2026-02-17
**Auditor:** HCI Expert (Nielsen Heuristics, Gestalt, IA)
**Scope:** All screens, shell components, and cross-cutting patterns
**Reference prototype:** `docs/ui/cockpit/index.html`, `wireframe.css`, `wireframe.js`
**Previous audit:** `docs/ui/cockpit/ux-audit-report.md` (Round 1)

---

## Executive Summary

Round 1 identified five fundamental problems: no orientation, flat visual
hierarchy, domain jargon overload, too many concepts per screen, and unclear
CTAs. The team addressed these with hero prompts, visual hierarchy tiers,
jargon renames, AB layout variants, a triage queue, a workflow builder, and
an agent configuration screen.

**Overall verdict: Significant improvement.** The prototype moved from
"I don't get it" territory to a coherent, task-driven interface. However,
the redesign solved some problems and introduced others. This audit
catalogues what is now fixed, what gaps remain from round 1, and what NEW
issues the round 2 changes introduced.

### Scorecard: Round 1 Top 5 Fixes

| #   | Round 1 Recommendation                    | Status       | Notes                                                                                                                                                                             |
| --- | ----------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Add hero task prompt per screen           | **Fixed**    | Hero prompts on Inbox, Project, Work Items, Approvals, WF Builder, Agents                                                                                                         |
| 2   | Establish real visual hierarchy           | **Partial**  | `card--featured`, `card--subtle`, `card--hero` exist in CSS but only `card--featured` is used in HTML (Inbox persona reordering). Most cards still use identical styling.         |
| 3   | Replace jargon with plain-language labels | **Partial**  | "SoR Refs" -> "Linked Systems", "Port Family" -> "Category" in some places. But "SoD: maker-checker", "hash-chained evidence", "Capability Matrix", and "scoped issuance" remain. |
| 4   | Reduce Inbox density to single list       | **Not done** | Inbox still uses 2-column card grid. Variant B (priority matrix) is an alternative layout, not a simplification. Both variants remain dense.                                      |
| 5   | Differentiate navigation levels           | **Fixed**    | Sidebar now has clear section titles (Workspace, Work, Configuration, Quick Actions, Support) with icons and badge counts. Major improvement.                                     |

### New Top 5 Issues (Round 2)

| #   | Issue                                                                              | Severity | Source        |
| --- | ---------------------------------------------------------------------------------- | -------- | ------------- |
| 1   | AB toggle lacks discoverability and explanation                                    | Major    | New (R2)      |
| 2   | Triage card UX has no undo, keyboard focus traps, and missing accessibility states | Critical | New (R2)      |
| 3   | Workflow builder lacks validation, delete, and error feedback                      | Major    | New (R2)      |
| 4   | Remaining jargon on primary surfaces still blocks first-use comprehension          | Major    | Residual (R1) |
| 5   | Visual hierarchy tiers are defined in CSS but underutilized in HTML                | Major    | Residual (R1) |

---

## Nielsen's 10 Heuristics: Per-Screen Assessment

### H1: Visibility of System Status

#### What improved (Round 2)

- Hero prompts on each screen now give immediate context: "You have 2 approvals
  waiting" (Approvals), "You have 7 work items" (Work Items), "A run failed and
  can be retried" (Inbox). This directly addresses the R1 "no orientation"
  problem.
- Triage progress bar shows "1 of 2 pending" with a visual fill.
- Workflow builder step indicators use color-coded left borders and typed
  status badges (Action, Gate, Condition, Notify, Agent).
- Agent cards show live stats (runs/7d, success rate, avg time) and a
  connection health banner.

#### What remains broken

| ID    | Screen           | Severity | Issue                                                                                                                                                                                                                                    |
| ----- | ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1-R1 | Triage           | Major    | After swiping a card (approve/deny/etc.), no toast, banner, or summary confirms what just happened. The card animates away but there is no "Approved: AG-442" confirmation message. The user cannot verify their action was recorded.    |
| H1-R2 | Triage           | Major    | The progress bar fill (`width: 0%` hardcoded in HTML) never updates visually after a card is processed -- JS updates `triageIndex` but does not update `.triage__progress-fill` width or `.triage__current` text in the DOM.             |
| H1-R3 | Workflow Builder | Minor    | Zoom controls (+, -, Fit) are non-functional in the prototype. While acceptable for lo-fi, the controls suggest interactivity that does not exist, violating the status heuristic. Add a "prototype only" hint or disable them visually. |
| H1-R4 | Agents           | Minor    | The "Test connection" button has no loading/pending state. Clicking it should show a spinner or "Testing..." state before showing the result in the integrity banner.                                                                    |
| H1-R5 | AB Toggle        | Major    | When the user switches layouts (A/B), there is no explanation of what changed. A brief label or tooltip should say "Switched to table view" or "Switched to triage view." The single-letter labels "A" and "B" are meaningless.          |

#### Recommendations

- **Triage: Add a toast/banner** after each decision: "Approved: Create Invoice in NetSuite (AG-442)." Dismiss automatically after 3 seconds or on next action.
- **Triage: Fix progress bar** in JS -- after each `triageAction()`, update `.triage__progress-fill` width and `.triage__current` text.
- **AB Toggle: Add descriptive labels** or at minimum a tooltip: "A = Table | B = Triage" or "A = Cards | B = Priority Matrix."

---

### H2: Match Between System and Real World

#### What improved

- "SoR Refs" column header renamed to "Linked Systems" in Work Items table.
- "Port Family: PaymentsBilling" filter chip renamed to "Category: Payments & Billing."
- "Quick Actions" card in Project Overview renamed to "Common Workflows."
- Heatmap labels in Project Overview variant B use "CRM Sales", "Finance",
  "Payments", "Support" instead of "CrmSales", "FinanceAccounting", etc.
- "Attach ExternalObjectRef" button renamed to "Link external record."
- Evidence variant B uses "Audit log: OK" instead of "Chain: verified."
- "Execution Tier distribution (effective)" renamed to "Automation level
  distribution" in the Project Overview card.

#### What remains broken

| ID    | Screen           | Severity | Issue                                                                                                                                                                                                                                                                                |
| ----- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | --------------------- | ------------------------------------------------------------------------------ |
| H2-R1 | Evidence         | Major    | Subtitle still says "Explore and verify hash-chained evidence entries." Non-auditors do not know what "hash-chained" means. The R1 recommendation was: "This is a record of everything that happened, in order."                                                                     |
| H2-R2 | Evidence         | Minor    | Evidence entry titles still use "EvidenceEntry:" prefix. R1 recommended removing it.                                                                                                                                                                                                 |
| H2-R3 | Settings         | Minor    | Subtitle still says "RBAC, credential vaulting, adapters/providers, and policies." R1 recommended: "Users & Roles, API Keys, Connected Systems, Rules."                                                                                                                              |
| H2-R4 | Settings         | Minor    | Credentials card subtitle still says "Vaulting, rotation, scoped issuance."                                                                                                                                                                                                          |
| H2-R5 | Run Detail       | Minor    | "Portarium intends to..." phrasing still appears in planned effects hint text on both Work Item Detail and Run Detail. R1 recommended "This workflow will..."                                                                                                                        |
| H2-R6 | Work Item Detail | Minor    | "SoD: maker-checker" still appears in the `<h1>` on Work Item Detail. R1 recommended this be moved to detail/drawer views.                                                                                                                                                           |
| H2-R7 | Work Items       | Minor    | Empty state text: "A Work Item binds ExternalObjectRefs, Runs, Approvals, and Evidence." Uses "ExternalObjectRefs" -- should be "linked records."                                                                                                                                    |
| H2-R8 | Triage Card      | Minor    | "Requires different approver" is used in priority matrix variant B, which is a good rename of "SoD: maker-checker." But the triage card front still shows `<span class="sod-badge">Requires different approver</span>` alongside the more jargon-heavy callout: "Tier: Human-approve | Rule: Invoice writes > $10,000 | Required approvers: 2 | Scopes: netsuite.write, drive.write" -- the "Scopes" line is developer jargon. |

#### Recommendations

- Finish the jargon cleanup pass. A simple search for these terms and their
  replacement would close all residual H2 issues:
  - "hash-chained evidence" -> "tamper-proof audit log" (or just "audit log")
  - "EvidenceEntry:" prefix -> remove entirely
  - "credential vaulting" -> "API credentials"
  - "scoped issuance" -> remove or replace with "per-integration keys"
  - "ExternalObjectRefs" -> "linked records"
  - "Portarium intends to..." -> "This workflow will..."
  - "SoD: maker-checker" in `<h1>` -> move to detail view
  - "Scopes: netsuite.write, drive.write" -> "Permissions: NetSuite (write), Drive (write)"

---

### H3: User Control and Freedom

#### What improved

- Triage card back (detail view) has explicit "Collapse details" and
  keyboard shortcut (Space) to toggle, giving clear exit from expanded state.
- Run Detail approval form now defaults to "Select decision..." placeholder
  instead of defaulting to "Approve." This directly addresses R1 finding RD2.

#### What remains broken / newly introduced

| ID    | Screen           | Severity | Issue                                                                                                                                                                                                                                                                                                             |
| ----- | ---------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H3-R1 | Triage           | Critical | **No undo after swipe.** Once a card animates away (approve/deny/skip/changes), the decision is final. In a governance tool where a mis-tap on "Deny" can block a workflow, there MUST be an undo mechanism. At minimum: a 3-second "Undo" toast or a "Review decisions" step before the "All caught up" summary. |
| H3-R2 | Triage           | Major    | The rationale input for deny/changes has no way to go back to a different decision. The "Cancel" button hides the rationale panel but does not allow switching to a different action (e.g., the user wanted "Changes" but accidentally clicked "Deny").                                                           |
| H3-R3 | Workflow Builder | Minor    | Undo/Redo buttons exist in the header but are non-functional. No `disabled` state or visual indicator that they are placeholders. Users expect real undo in a builder tool.                                                                                                                                       |
| H3-R4 | Workflow Builder | Major    | No way to delete a node from the canvas. Users can add steps from the palette but cannot remove them. For a builder interface, this is a fundamental control gap.                                                                                                                                                 |
| H3-R5 | Agents           | Minor    | "Deactivate" button has no confirmation dialog. Deactivating an agent used in active workflows could break running processes.                                                                                                                                                                                     |

#### Recommendations

- **Triage: Add undo toast.** After each swipe, show: "Denied AG-442 -- [Undo] (3s)" at the bottom. If undo is tapped, restore the card. This is standard in email clients (Gmail) and task apps.
- **Workflow Builder: Add node deletion.** Selected node should have a Delete button in the config panel or a keyboard shortcut (Delete/Backspace).
- **Agents: Add confirmation dialog** for Deactivate: "This agent is used in 1 active workflow. Deactivating will prevent it from running. Continue?"

---

### H4: Consistency and Standards

#### What improved

- Sidebar nav items now all have icons and follow a consistent pattern
  (icon + label + optional badge).
- Badge counts are present on Inbox (5), Work Items (7), Runs (1),
  Approvals (2), and Agents (1). Consistent pattern.
- AB toggle follows a single consistent pattern across all screens.
- Filter chips follow a consistent visual pattern.

#### What remains broken / newly introduced

| ID    | Screen           | Severity | Issue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | ---------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H4-R1 | Cross-cutting    | Major    | The Approvals screen uses TWO independent view-switching mechanisms: the AB toggle (injected by `ABToggle.register`) and the triage-mode toggle buttons ("Table view" / "Triage view"). But the Approvals screen is NOT registered with ABToggle -- only Inbox, Work Items, and Project are. So the triage toggle is the actual view switcher, but users may expect the AB pattern they learned on other screens. The Approvals screen should either use the AB toggle system (register as variant A=table, B=triage) or clearly differentiate its toggle as something different. |
| H4-R2 | Triage vs. Table | Minor    | The triage view mode toggle uses `btn--primary` to highlight the active mode, while the AB toggle uses `ab-toggle__label--active` (subtle background). Two different visual patterns for "which view am I in" creates inconsistency.                                                                                                                                                                                                                                                                                                                                              |
| H4-R3 | Cross-cutting    | Minor    | "Context" buttons appear on Inbox, Project, Work Item Detail, Run Detail, and Evidence -- but NOT on Work Items list, Runs list, Approvals, Workflow Builder, Agents, or Settings. The inconsistency makes users wonder whether some screens are missing the drawer or whether it was intentionally omitted. Either add to all screens or remove from most and consolidate into the sidebar.                                                                                                                                                                                      |
| H4-R4 | Workflow Builder | Minor    | The config panel on the right uses "Automation Level" as the label for the tier selector dropdown, while the triage card uses "Tier" and the Work Items table column says "Tier." One concept, three names.                                                                                                                                                                                                                                                                                                                                                                       |
| H4-R5 | Work Item Detail | Minor    | The "SoD: maker-checker" badge in the Work Item Detail `<h1>` is different from the Triage card header which says "Requires different approver." Same concept, two labels on different screens.                                                                                                                                                                                                                                                                                                                                                                                   |

#### Recommendations

- **Approvals: Migrate to ABToggle system.** Register `approvals` with variants
  `['A','B']` where A = table view, B = triage view. Remove the custom
  triage-toggle buttons. This gives a consistent switching pattern across
  all screens.
- Standardize tier terminology: pick either "Tier" or "Automation Level"
  and use it everywhere. Suggestion: "Automation Level" for user-facing
  labels, since it was adopted to replace the jargon-heavy "Execution Tier."

---

### H5: Error Prevention

#### What improved

- Decision dropdown now defaults to placeholder "Select decision..." instead
  of "Approve." This prevents accidental approval (R1 fix RD2).
- Triage deny/changes flow requires rationale before submission (good
  governance pattern).

#### What remains broken / newly introduced

| ID    | Screen           | Severity | Issue                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H5-R1 | Triage           | Critical | **Approve action has no rationale requirement.** Deny and Changes require rationale input, but Approve does not. In a governance/compliance tool, ALL decisions should require rationale. An approver should document WHY they approved, not just click a button. At minimum, make the approve flow match deny: show rationale input with "Rationale (required for approve)" or at least "Rationale (recommended)." |
| H5-R2 | Triage           | Major    | The keyboard shortcuts (A/D/R/S) fire immediately with no confirmation. Pressing "D" on the keyboard instantly denies the approval -- but "D" is also a common key in text fields. If a user is typing in the rationale textarea and it loses focus, the next "D" keypress will deny the approval. The keyboard handler should check `document.activeElement` to avoid capturing keypresses in input fields.        |
| H5-R3 | Workflow Builder | Major    | "Run workflow" button in the header fires from a draft state with no validation. A draft workflow may have disconnected nodes, missing configurations, or invalid conditions. There should be a validation step before allowing "Run."                                                                                                                                                                              |
| H5-R4 | Settings         | Minor    | R1 finding ST2 remains: "Add user," "Add credential," "Rotate," "Select provider," "Register adapter," and "Create rule" all lack visible confirmation flows.                                                                                                                                                                                                                                                       |

#### Recommendations

- **Triage: Require rationale for ALL decisions**, including approve. This is a
  governance tool -- audit trails need the "why" for every decision.
- **Triage: Guard keyboard shortcuts.** In the keyboard handler, add:
  `if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;`
  This prevents keypresses in form fields from triggering triage actions.
  **Note:** The current code checks `if (rationaleEl && !rationaleEl.hidden) return;`
  which only guards when the rationale panel is visible, but does NOT guard
  when focus is in ANY other input on the page.
- **Workflow Builder: Add validation.** "Run workflow" should first validate
  the graph (all nodes connected, required fields filled) and show errors
  inline before allowing execution.

---

### H6: Recognition Rather Than Recall

#### What improved

- Hero prompts eliminate the need to recall "what am I supposed to do on this
  screen?" Each screen now opens with a plain-language task description.
- Sidebar badge counts (Inbox 5, Approvals 2, etc.) let users recognize
  where work is waiting without navigating to each screen.
- Work Item Detail tabs now show counts: "Runs (1)", "Approvals (1)",
  "Evidence (12)." This directly addresses R1 finding WD3.
- Workflow builder palette items have icons + names + descriptions, making
  step types recognizable without memorization.
- Agent cards show provider identity (C = Claude, O = OpenAI, X = Custom)
  with color coding.

#### What remains broken / newly introduced

| ID    | Screen           | Severity | Issue                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H6-R1 | AB Toggle        | Major    | The AB toggle shows only "A" and "B" as labels. Users must click to discover what each variant is. This violates recognition -- users should see "Table" and "Kanban" (or "Cards" and "Matrix") without clicking.                                                                                                                                                                                                                                      |
| H6-R2 | Triage           | Minor    | The keyboard shortcut hint ("Keyboard: A = Approve, D = Deny, R = Request Changes, S = Skip, Space = Toggle details") appears below the action buttons. On smaller screens this may scroll out of view. Consider adding title/tooltip attributes to the buttons themselves.                                                                                                                                                                            |
| H6-R3 | Workflow Builder | Minor    | The config panel shows configuration for the selected node, but there is no breadcrumb or visual indicator showing WHICH node is selected. The selected node has `wf-node--selected` outline, but if the canvas is scrolled, the selection indicator is not visible in the config panel. Add the node name as a header in the config panel (already present as `wf-config__title` -- but it does not update dynamically for all node types in the JS). |
| H6-R4 | Evidence         | Minor    | R1 finding E4 remains: "EvidenceEntry:" prefix is still used on all titles.                                                                                                                                                                                                                                                                                                                                                                            |

#### Recommendations

- **AB Toggle: Show variant names**, not letters. Change "A|B" to "Table|Kanban"
  for Work Items, "Cards|Matrix" for Inbox, "Metrics|Dashboard" for Project,
  "Table|Triage" for Approvals. Implementation: modify `ABToggle.register()`
  to accept display labels alongside variant letters.

---

### H7: Flexibility and Efficiency of Use

#### What improved

- Triage mode provides an accelerated workflow for approvers processing
  a queue: swipe-style card stack with keyboard shortcuts (A/D/R/S/Space).
  This is a major UX win over the R1 table-only approach.
- AB toggle lets users choose their preferred layout per screen.
- Workflow builder palette provides quick-add for step types.
- Agent config provides both a card list (scan) and detail panel (configure)
  in a master-detail layout.

#### What remains broken / newly introduced

| ID    | Screen        | Severity | Issue                                                                                                                                                                                                                            |
| ----- | ------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H7-R1 | Cross-cutting | Major    | No command palette or global keyboard shortcuts. Power users (approvers processing 20+ gates, operators triaging failures) would benefit from Ctrl+K / Cmd+K to jump between screens, search, and execute actions without mouse. |
| H7-R2 | Triage        | Minor    | No batch operations. An approver who wants to approve 5 low-risk items cannot select and approve them all at once. The swipe model is one-at-a-time only.                                                                        |
| H7-R3 | Work Items    | Minor    | Kanban variant B does not support drag-and-drop (expected interaction for a kanban board). While acceptable for lo-fi, the visual affordance of kanban columns implies drag-and-drop without delivering it.                      |
| H7-R4 | Cross-cutting | Minor    | R1 finding S6 remains: no collapsed/icon-only sidebar mode. With sidebar (280px) + drawer (360px), chrome consumes 640px of horizontal space.                                                                                    |

#### Recommendations

- Consider a command palette (Cmd+K) for power users. This would provide
  quick navigation, search, and action execution. (This may already be
  planned as a separate feature.)
- For the triage queue, consider adding a "Quick approve all low-risk" batch
  action for approvers who trust the AI summary assessment.

---

### H8: Aesthetic and Minimalist Design

#### What improved

- "Quick Search" card removed from Inbox (commented out: "Fix 2: duplicates
  topbar search bar"). Good decluttering.
- "Common Workflows" card in Project Overview is more focused than the
  previous "Quick Actions" label.
- Variant B layouts (priority matrix, kanban, dashboard, triage) provide
  alternative information architectures that are less dense than variant A
  in some cases.

#### What remains broken / newly introduced

| ID    | Screen           | Severity | Issue                                                                                                                                                                                                                                                                                                              |
| ----- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H8-R1 | Inbox            | Major    | R1 finding I1 remains: Inbox variant A still shows 3-4 content sections simultaneously in a 2-column grid. The hero prompt helps orient, but the grid below it is still dense. Variant B (priority matrix) is equally dense with 4 quadrants.                                                                      |
| H8-R2 | Work Item Detail | Major    | R1 finding WD1 remains: header packs title + tier badge + SoD badge + owner + status. Policy callout, linked records card, tab bar, and effects card all appear above the fold. Still 6+ content zones.                                                                                                            |
| H8-R3 | Run Detail       | Major    | R1 finding RD1 partially remains: the approval gate card still contains policy callout + SoD callout + prior decisions + form + outcome preview + back link. This is 6 sections in one card. The outcome preview is now above the submit button (fixing R1 RD3), which is good, but the card density is unchanged. |
| H8-R4 | Settings         | Major    | R1 finding ST1 remains: Settings is still a single page with 4 dense cards in a 2-column grid plus inline capability matrix. R1 recommended sub-pages or collapsible sections.                                                                                                                                     |
| H8-R5 | Workflow Builder | Minor    | The wf-palette, wf-canvas, and wf-config panels are all visible simultaneously. On smaller screens, the 3-column layout collapses to stacked panels, making the config panel appear very far from the canvas. Consider making the config panel a collapsible side sheet or flyout.                                 |
| H8-R6 | Triage Card      | Minor    | The triage card front shows: header (ID + badges), title, metadata grid (4 items), effects summary (2 rows), policy callout, and expand button. This is 6 sections visible before expansion. The effects summary and policy callout could be collapsed into the "full details" back view.                          |

#### Recommendations

- **Inbox: Implement progressive disclosure.** Show only the #1 priority
  section expanded by default (per persona). Other sections appear as
  collapsed headers with counts: "Run Failures (2)" / "Policy Violations (1)."
  Click to expand.
- **Settings: Split into tabbed sub-sections.** Use horizontal tabs:
  "Users & Roles | Credentials | Integrations | Rules." Each tab shows
  one card's content.
- **Triage card front: Move effects and policy into the back (detail view).**
  The front should show only: title, risk-level indicator, key metadata
  (requester, time), and the approve/deny buttons. Details on demand.

---

### H9: Help Users Recognize, Diagnose, and Recover from Errors

#### What improved

- Agent error state is well-designed: the `agent-card__error` div shows
  "Connection failed: endpoint returned 502. Last checked 5m ago." This is
  clear, actionable, and timestamped.
- Banners for degraded/misconfigured/policy-blocked/RBAC-limited states
  provide context-specific error information.
- The misconfigured banner includes a link: "Go to Workspace settings."

#### What remains broken / newly introduced

| ID    | Screen           | Severity | Issue                                                                                                                                                                                                                                                                |
| ----- | ---------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H9-R1 | Status Bar       | Major    | R1 finding SB2 remains: status bar items are not clickable. "Events: degraded" should link to a diagnostic screen. "Chain: policy hold" should link to the relevant policy.                                                                                          |
| H9-R2 | Triage           | Minor    | If the triage rationale is submitted for a "deny" action, the code calls `triageAction('skip')` instead of `triageAction('deny')` -- this appears to be a bug (line 1065 in wireframe.js). The deny rationale submission should actually deny the item, not skip it. |
| H9-R3 | Workflow Builder | Major    | No validation errors shown. If a user clicks "Run workflow" with an incomplete graph (e.g., missing approval gate config, disconnected nodes), nothing happens. There should be inline error markers on invalid nodes and a summary banner listing issues.           |

#### Recommendations

- **Status bar: Make items clickable.** Each status item should link to its
  diagnostic context (Events -> Settings, Chain -> Evidence, Runs -> Runs list).
- **Triage: Fix the rationale-deny bug.** In `wireframe.js` line 1065, change
  `triageAction(action === 'deny' ? 'skip' : action)` to
  `triageAction(action)` so that deny with rationale actually records a deny.

---

### H10: Help and Documentation

#### What improved

- Hero prompts serve as lightweight, contextual in-app guidance.
- Sidebar persona hint explains the current mode: "Approver mode: Approval
  gates prioritised. SoD constraints visible."
- Workflow builder config panel shows a contextual callout: "This step will
  pause the run and require 2 approvers before continuing."

#### What remains broken

| ID     | Screen        | Severity | Issue                                                                                                                                                                                                                                       |
| ------ | ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H10-R1 | Cross-cutting | Minor    | The sidebar "Help & Documentation" link has `onclick="return false;"` -- it goes nowhere. While acceptable in a prototype, a link to the glossary (`docs/glossary.md`) or a "How this works" guide would be valuable for usability testing. |
| H10-R2 | Agents        | Minor    | The agent capabilities checkboxes (Read external records, Classify, Write, Generate, Analyze, Execute code) have no descriptions or help text explaining what each capability enables the agent to do in a workflow context.                |
| H10-R3 | AB Toggle     | Major    | No explanation of what the A/B toggle does or what each variant means. A first-time user may not understand this is a layout preference control. Add a tooltip: "Switch between layout views for this screen."                              |

---

## New Screens Assessment

### Workflow Builder (NEW)

**Overall:** Well-structured 3-panel layout (palette, canvas, config) that
follows established builder conventions (Figma, n8n, Zapier). The visual
design is coherent and the node typing system (color-coded left borders, typed
icons) is effective.

**Strengths:**

- Node types are visually distinct: color-coded borders + icons make action/
  approval/condition/notification/agent immediately recognizable.
- Config panel provides contextual configuration with clear field labels.
- "Automation Level" dropdown (renamed from "Execution Tier") is a good
  jargon fix.
- Branch logic with Yes/No labels and visual connectors is clear.
- Hero prompt: "Build your workflow by connecting steps. Click any node to
  configure it." is effective guidance.

**Issues (detailed above):**

- No node deletion (H3-R4)
- No validation before "Run workflow" (H5-R3, H9-R3)
- Non-functional zoom controls (H1-R3)
- Config panel does not always update on node selection (H6-R3)

**Additional workflow-specific issues:**

| ID   | Severity | Issue                                                                                                                                                                                                              |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WF-1 | Minor    | No visual indication that the palette items are draggable or clickable to add. The hint says "Click to add to canvas" but clicking does not add a node (prototype limitation).                                     |
| WF-2 | Minor    | The branch visualization (Yes/No paths) uses left-border + padding indentation to create tree structure. This works for simple If/Else but will not scale to complex graphs with merges, parallel paths, or loops. |
| WF-3 | Minor    | No "Save draft" confirmation feedback. Users cannot tell if saving succeeded or if changes are unsaved.                                                                                                            |

---

### Agents (NEW)

**Overall:** Excellent master-detail layout with clear information hierarchy.
Agent cards provide at-a-glance health/performance metrics, and the detail
panel offers comprehensive configuration with tabs.

**Strengths:**

- Provider identity (color-coded icons: orange=Claude, green=OpenAI,
  gray=Custom) is immediately recognizable.
- Error state on the "Policy Validator" card is prominent and actionable.
- Stats (runs/7d, success %, avg time) provide meaningful operational context.
- Capability checkboxes provide clear, scannable permission controls.
- Prompt template editing is inline and contextual.
- Tabs (Configuration, Usage, Integrations) separate concerns cleanly.
- The "Integrations" tab showing "Workflows using this agent" provides
  excellent cross-reference visibility.

**Issues (detailed above):**

- No confirmation for "Deactivate" (H3-R5)
- No loading state for "Test connection" (H1-R4)
- Capability checkboxes lack help text (H10-R2)

**Additional agent-specific issues:**

| ID   | Severity | Issue                                                                                                                                                                                                                      |
| ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AG-1 | Minor    | The agent list scrolls independently from the detail panel. On small screens, the list becomes horizontally scrollable (responsive CSS), which may cause cards to be partially visible and hard to scan.                   |
| AG-2 | Minor    | No visual indicator of which capabilities are "dangerous" (e.g., "Write external records" and "Execute code" are higher-risk than "Read" or "Analyze"). These should have a warning color or icon to signal elevated risk. |

---

### Triage Queue (NEW)

**Overall:** The triage card stack is the most significant UX improvement in
round 2. The swipe metaphor with keyboard shortcuts creates a fast approval
processing flow that directly addresses the R1 problem of "no way to approve
directly from the Approvals screen" (finding A3).

**Strengths:**

- Card stack metaphor with next-card preview creates a clear "process queue"
  mental model.
- Keyboard shortcuts (A/D/R/S/Space) enable rapid processing.
- Card exit animations (right=approve, left=deny, up=changes, down=skip) use
  directional metaphor to reinforce the action.
- "Show full details (Space)" expand/collapse provides progressive disclosure.
- Rationale requirement for deny/changes enforces governance compliance.
- "All caught up" completion state with stats summary is satisfying and
  informative.

**Issues (detailed above):**

- No undo (H3-R1) -- CRITICAL for governance
- No confirmation feedback after swipe (H1-R1)
- Keyboard shortcuts fire from form fields (H5-R2)
- Approve action does not require rationale (H5-R1)
- Progress bar does not update (H1-R2)
- Rationale submit for deny actually fires skip (H9-R2) -- BUG

---

## Gestalt Principles Reassessment

| Principle         | Round 1 State | Round 2 State | Change                                                                                                                                                                                                                                                                                            |
| ----------------- | ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Proximity**     | Weak          | Improved      | Section titles in sidebar create clear grouping. Hero prompts are visually separated from content. But card grids still use uniform 12px gaps without proximity variation.                                                                                                                        |
| **Similarity**    | Weak          | Improved      | Agent cards, workflow nodes, and triage cards have distinct visual identities. CSS tier classes (`card--featured`, `card--subtle`, `card--hero`) exist but are underutilized in HTML.                                                                                                             |
| **Continuity**    | Missing       | Partial       | Workflow builder connectors (lines + arrows) create visual flow. Run state machine steps create a horizontal progression. But evidence list still lacks timeline connectors (R1 finding E6).                                                                                                      |
| **Closure**       | Adequate      | Adequate      | No change. Cards and tables have clear boundaries.                                                                                                                                                                                                                                                |
| **Figure-Ground** | Weak          | Improved      | Hero prompts use `border: 2px solid var(--info)` with `rgba(37, 87, 167, 0.04)` background tint, creating a clear visual tier above standard cards. Workflow canvas uses dot-grid background to distinguish it from panels. But most content cards still share identical border/shadow treatment. |

---

## Prioritized Action Items

### Critical (Must Fix)

1. **Add undo to triage decisions.** After each swipe action, display a toast
   with "[Action] [Gate title] -- Undo (3s)" that allows one-tap reversal.
   Without undo, a governance tool cannot be trusted for production use.

2. **Fix the triage deny-rationale bug.** `wireframe.js` line 1065 calls
   `triageAction('skip')` when it should call `triageAction('deny')` after
   rationale is submitted for a deny action.

3. **Guard triage keyboard shortcuts from form fields.** Add
   `if (e.target.matches('input, textarea, select')) return;` at the top
   of the triage keyboard handler. This prevents accidental approvals/denials
   when typing in a text field.

4. **Require rationale for approve actions.** In a compliance/governance tool,
   every decision must be documented. Treat approve the same as deny: show
   the rationale input panel before finalizing.

### Major (Should Fix)

5. **Make AB toggle labels descriptive.** Replace "A|B" with meaningful labels:
   "Table|Kanban", "Cards|Matrix", "Metrics|Dashboard", "Table|Triage." Users
   should not have to guess what each variant shows.

6. **Fix triage progress bar updates.** After each `triageAction()`, update
   `.triage__progress-fill` width and `.triage__current` counter to reflect
   actual progress. Also add a confirmation toast/banner.

7. **Unify the Approvals view toggle with the AB toggle system.** Register
   the Approvals screen with `ABToggle.register('approvals', ...)` and remove
   the custom triage-toggle buttons. This gives users a consistent switching
   pattern across all screens.

8. **Finish the jargon cleanup.** Complete the remaining renames identified
   in H2 residual findings (H2-R1 through H2-R8). This is a text-only change
   across `index.html`.

9. **Add delete node to workflow builder.** When a node is selected, show a
   "Delete" button in the config panel and support Delete/Backspace keyboard
   shortcut. Add validation before "Run workflow."

10. **Split Settings into tabbed sub-sections.** Replace the 4-card 2-column
    grid with horizontal tabs: "Users & Roles | Credentials | Integrations |
    Rules." This addresses the R1 finding ST1 that was not implemented.

### Minor (Nice to Fix)

11. **Make status bar items clickable.** Link each status to its diagnostic
    screen.

12. **Add visual timeline connector to evidence list.** A left-border vertical
    line connecting evidence entries would reinforce the "chain" metaphor
    (R1 finding E6).

13. **Apply visual hierarchy CSS classes.** The CSS defines `card--subtle`,
    `card--hero`, and `card--featured` but only `card--featured` is used in
    HTML (Inbox persona). Apply `card--subtle` to metadata/reference sections
    and `card--hero` to primary actionable cards across all screens.

14. **Add tooltip to AB toggle.** Explain: "Switch between layout views for
    this screen."

15. **Implement progressive disclosure on Inbox.** Show only the persona's
    primary section expanded; collapse others to headers with counts.

16. **Agent capability risk indicators.** Add a warning icon or amber border
    to "Write external records" and "Execute code" checkboxes.

17. **Add "Test connection" loading state** to agent detail panel.

18. **Remove "EvidenceEntry:" prefix** from evidence entry titles.

---

## Summary

Round 2 made substantial progress on the top R1 problems:

- **Task orientation:** Hero prompts solved. Every screen now answers
  "What should I do?"
- **Navigation clarity:** Sidebar grouping, icons, and badges are a
  major improvement.
- **Jargon:** Partially addressed. About 60% of the worst terms have been
  renamed, but 40% remain (especially on Evidence, Settings, and detail views).
- **Information density:** Partially addressed through AB variants and triage
  mode, but the default variant A layouts remain dense on Inbox, Work Item
  Detail, and Settings.
- **Visual hierarchy:** CSS infrastructure exists but is underutilized. Hero
  prompts provide a top-level tier; below that, everything still has equal
  weight.

The new features (triage queue, workflow builder, agents) are well-designed
at the structural level. The triage queue is the standout improvement -- it
transforms approval processing from "navigate to each run and fill a form"
into a fast, keyboard-driven flow. However, it needs critical governance
safeguards (undo, rationale for all decisions, keyboard guard) before it can
be trusted for production use.

The single most impactful remaining task is making the AB toggle and triage
UX production-safe: add undo, fix the deny bug, guard keyboard shortcuts,
and require rationale for all decisions.
