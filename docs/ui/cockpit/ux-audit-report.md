# UX Audit Report: Portarium Cockpit Lo-Fi Prototype

**Date:** 2026-02-17
**Auditor:** HCI Expert (Nielsen Heuristics, Gestalt, IA)
**Scope:** All screens, shell components, and cross-cutting patterns
**Reference prototype:** `docs/ui/cockpit/index.html`, `wireframe.css`, `wireframe.js`

---

## Executive Summary

The prototype is structurally sound for a low-fidelity wireframe: it has correct semantic HTML, accessible landmarks, keyboard support, and a principled persona-switching system. However, it suffers from five fundamental problems that explain the user reaction **"I just don't get it. It feels weird. I don't see how this helps."**

### Root Cause of "I Don't Get It"

The feeling stems from a combination of:

1. **No orientation or framing** -- The UI drops users into dense operational data without first answering "What is this tool? What am I supposed to do here?" There is no onboarding affordance, no welcome state, and no task-oriented framing. Every screen reads as a data dump, not a guide.

2. **Flat visual hierarchy** -- Every element has equal visual weight: same border thickness (2px), same shadow, same border radius, same font weight distribution. Nothing draws the eye. The grid paper background reinforces "wireframe draft" rather than "tool I can trust."

3. **Domain jargon overload** -- Terms like "SoD: maker-checker," "idempotency key," "retry-safe," "port family," "hash-chained evidence," and "ExternalObjectRef" appear on primary surfaces. A first-time user (even a technical one) cannot parse these without training.

4. **Too many concepts per screen** -- The Inbox shows approval gates, run failures, policy violations, and next-action prompts simultaneously with no progressive disclosure. Cognitive load per screen is very high.

5. **Unclear calls-to-action** -- Primary actions compete with secondary ones. "Context" buttons appear on every screen but their purpose is opaque. The "Start workflow" CTA appears in 4+ places with no differentiation.

### Top 5 Fixes (Priority Order)

| #   | Fix                                                                                                                                                                                                                           | Impact   | Effort |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| 1   | **Add a hero task prompt per screen** that answers "What should I do here?" in plain language, with a single primary CTA. Replace the current "next-action" bar (which is buried) with a prominent, screen-top guided prompt. | Critical | Medium |
| 2   | **Establish real visual hierarchy** by reducing border/shadow uniformity. Use weight, size, and whitespace to create clear F-pattern or Z-pattern reading paths. Make primary cards visually distinct from secondary ones.    | Critical | Medium |
| 3   | **Replace jargon with plain-language labels** on primary surfaces. Move technical details (SoD, idempotency, chain hashes) into expandable/secondary panels. First-time legibility must not require a glossary.               | Critical | Low    |
| 4   | **Reduce Inbox density** by showing only the single most important section per persona by default, with expandable sections for the rest. Use progressive disclosure aggressively.                                            | Major    | Medium |
| 5   | **Differentiate navigation levels** -- The sidebar mixes workspace-level, project-level, and quick-action nav into one flat list. Group them visually and semantically.                                                       | Major    | Low    |

---

## Per-Screen Analysis

---

### Shell: Topbar

**What is currently there:**
A horizontal bar spanning full width containing: brand mark ("P" + "Portarium" + "Cockpit Prototype"), center section with global search input and notifications button (with badge "3"), and right-aligned prototype controls (Persona, Workspace, State dropdowns).

**HCI Violations:**

| ID  | Heuristic             | Severity | Issue                                                                                                                                                                                                               |
| --- | --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | H4: Consistency       | Minor    | The prototype controls (Persona/Workspace/State) are mixed with production UI elements. Users testing the prototype may confuse these with real settings.                                                           |
| T2  | H8: Minimalist design | Minor    | Notifications button uses text "Notifications" plus a badge. An icon-only approach with aria-label would save space and match platform conventions.                                                                 |
| T3  | H6: Recognition       | Minor    | Search placeholder "Search Work Items, Runs, Evidence, SoR refs..." uses jargon ("SoR refs") that most users won't know.                                                                                            |
| T4  | H1: Visibility        | Major    | At mobile breakpoint (< 980px), `topbar__center` is `display: none`, removing search and notifications entirely with no alternative access point. Users lose a critical feature with no indication it still exists. |

**Recommendations:**

- Visually separate prototype controls from the real UI with a colored banner or collapsible debug panel.
- Simplify search placeholder to "Search work items, runs, evidence..." (drop "SoR refs").
- On mobile, collapse search into a search icon button rather than hiding it entirely.

---

### Shell: Sidebar

**What is currently there:**
A 280px left column containing: main navigation (7 items: Inbox, Project Overview, Work Items, Runs, Approvals, Evidence, Settings), "Quick Actions" section (2 persona-adaptive links), a persona hint box (dashed border, explains current mode), and "Support" section with a help link.

**HCI Violations:**

| ID  | Heuristic             | Severity | Issue                                                                                                                                                                                                                                                                      |
| --- | --------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | H4: Consistency       | Major    | Navigation items are styled identically to buttons (solid border, shadow, white background). They look like action buttons, not navigation links. This violates the standard sidebar navigation pattern where items should appear as a vertical menu, not a grid of cards. |
| S2  | H6: Recognition       | Major    | All 7 nav items have equal visual weight. There is no icon, no grouping, no count badge. Users must read every label to find what they need.                                                                                                                               |
| S3  | H2: Match real world  | Minor    | "Quick Actions" mixes workspace navigation with in-context actions. "Start workflow" (a link to #work-items) is not an action -- it is navigation. "Retry failed runs" (a link to #runs) is also navigation.                                                               |
| S4  | H8: Minimalist design | Minor    | The persona hint box is helpful for prototyping but should not ship. In production, contextual help should be integrated, not a static text block.                                                                                                                         |
| S5  | Gestalt: Proximity    | Major    | There are 3 distinct nav groups (Main nav, Quick Actions, Support) but only a small section title separates them. The visual gap is insufficient to create clear grouping.                                                                                                 |
| S6  | H7: Flexibility       | Minor    | No collapsed/icon-only sidebar mode. At 280px, it consumes significant horizontal space, especially when the drawer is also open (280 + 360 = 640px of chrome).                                                                                                            |

**Recommendations:**

- Add icons to each nav item (even lo-fi placeholder icons) to support scanability and recognition.
- Style nav items as a flat list (no borders, no shadows) and use indentation or left-border highlight for the active item, matching standard sidebar patterns (VS Code, Jira, Linear).
- Add badge counts to nav items (e.g., "Approvals (2)", "Inbox (5)") to provide information scent.
- Increase vertical spacing between nav groups. Use a horizontal rule or larger margin gap.

---

### Shell: Drawer (Right Panel)

**What is currently there:**
A 360px right panel that slides in from the right. Contains a header with title + close button, and a body that is dynamically populated with "Correlation Context" including: correlation thread (linked WI/Run/Approval/Evidence), SoR Ref Cluster (chips), Policy Evaluation (callout), and Next Action prompt.

**HCI Violations:**

| ID  | Heuristic            | Severity | Issue                                                                                                                                                                                                           |
| --- | -------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | H6: Recognition      | Major    | The trigger for the drawer is a button labeled "Context" with no icon and no tooltip. Users do not know what "Context" means in this application. Is it settings? Help? Related items?                          |
| D2  | H3: User control     | Minor    | The drawer can be closed with Escape or the X button (good), but there is no overlay/backdrop to click. Standard drawer pattern includes backdrop dismissal.                                                    |
| D3  | H1: Visibility       | Minor    | When the drawer is open, the `.app--drawer-open` class pushes content to a 3-column layout. This is elegant but can cause content reflow that is disorienting.                                                  |
| D4  | H2: Match real world | Major    | The drawer title "Correlation Context" uses domain jargon. Users think in terms of "Related items" or "Details" or "Side panel," not "Correlation Context."                                                     |
| D5  | Cognitive load       | Major    | The drawer contains 4 sections (Thread, SoR Refs, Policy, Next Action) that duplicate information already present on the main screen. It is unclear when a user should look at the drawer vs. the main content. |

**Recommendations:**

- Rename "Context" button to "Related" or use a side-panel icon (e.g., a panel-right icon).
- Rename "Correlation Context" to "Related Items" or "Details Panel."
- Clarify the drawer's unique value: it should show cross-entity relationships that are NOT visible on the current screen. If it duplicates the main content, it adds clutter without value.
- Consider making the drawer the primary detail view for list screens (master-detail pattern) rather than a supplementary panel.

---

### Shell: Status Bar

**What is currently there:**
A 36px footer bar spanning full width with 3 status indicators: "Runs: 1 active" (green dot), "Chain: verified" (green dot), "Events: connected" (green dot). Dots change color based on system state.

**HCI Violations:**

| ID  | Heuristic            | Severity | Issue                                                                                                                                                                      |
| --- | -------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SB1 | H1: Visibility       | Minor    | Status bar is easy to overlook due to small size and low contrast. It communicates critical system health information that may go unnoticed.                               |
| SB2 | H9: Error recovery   | Major    | When the status is degraded (e.g., "Events: degraded"), the status bar only reports the problem but provides no action. There is no click-to-diagnose or link to settings. |
| SB3 | H2: Match real world | Minor    | "Chain: verified" is meaningless to users who do not understand evidence chaining. "Audit log: OK" would be more universally understood.                                   |

**Recommendations:**

- Make status bar items clickable, linking to the relevant diagnostic screen (e.g., "Events: degraded" links to Settings).
- Use plain language: "Audit log: OK" instead of "Chain: verified."
- When degraded, use a more prominent notification (banner or toast) rather than relying on users noticing a small dot color change.

---

### Screen: Inbox

**What is currently there:**

- Header: "Inbox" + subtitle "Items that need your attention" + CTA button "Start workflow" + "Context" button
- Filters: chips for persona-default filters, "Assigned to me," "Unassigned," "Pending approvals," "Failed runs"
- Next-action prompt: blue-bordered bar with "Run R-8850 failed: CRM sync hit rate limit. Retry available." + "Retry run" button
- 2-column grid with cards: "Pending Approval Gates" (2 items), "Run Failures" (2 items)
- 2nd 2-column grid: "Policy Violations" (1 item), plus hidden cards for Evidence and Workspace Health (shown for auditor/admin personas)
- Empty state with explanation and CTA

**HCI Violations:**

| ID  | Heuristic              | Severity | Issue                                                                                                                                                                                                                      |
| --- | ---------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1  | H8: Minimalist design  | Critical | The Inbox shows 3-4 content sections simultaneously, each with its own card, list, badges, and metadata. Total information density is very high. A user seeing this for the first time has no focal point.                 |
| I2  | H1: Visibility         | Major    | The "next-action prompt" is the most actionable element on the page, but it sits below the filter chips and has the same visual weight as the cards below it. It should be the dominant element.                           |
| I3  | H6: Recognition        | Major    | Filter chips "Default filters: failures + blocks" is a meta-description of the filtering logic, not a user-facing filter label. Users expect filter chips to describe the content being shown, not the system's reasoning. |
| I4  | H2: Match real world   | Major    | "Pending Approval Gates" uses formal domain language. "Awaiting your approval" or "Needs your decision" is more natural.                                                                                                   |
| I5  | H2: Match real world   | Major    | Rows contain stacked badges: `Human-approve` + `SoD: maker-checker` + `retry-safe`. This is 3 levels of domain metadata on a single list row. Users cannot parse these without training.                                   |
| I6  | H5: Error prevention   | Minor    | The "Retry run" button in the next-action prompt performs an action directly from the Inbox with no confirmation. Given that retries may have side effects, this should navigate to the Run detail for review first.       |
| I7  | Gestalt: Figure-ground | Major    | The grid-paper background, card borders, chip borders, badge borders, and row borders all compete. There is no clear figure-ground separation. Everything is "figure."                                                     |
| I8  | Task clarity           | Critical | The Inbox does not answer "What should I do first?" It presents 4 categories of items with equal prominence. The persona-adaptive ordering helps but is not sufficient -- there should be a single, clear primary task.    |
| I9  | H4: Consistency        | Minor    | The "Policy Violations" card has inline action buttons ("Assign approver", "Edit policy") while other cards use row-level links. Inconsistent interaction pattern.                                                         |

**Recommended Layout Alternative:**
Replace the current multi-card grid with a **single prioritized list** (like a notification inbox in Slack or GitHub). Each item in the list should be one row with: icon (type: approval/failure/violation), title, subtitle, status badge, and action button. The persona system should control sort order, not card visibility. This reduces cognitive load and provides a clear "start at the top, work down" mental model.

**Specific Fixes:**

- Promote the next-action prompt to a hero banner at the top of the screen with large text and a prominent CTA.
- Collapse cards into a single unified list with type indicators (icon or color-coded left border).
- Move filter meta-descriptions (like "Default filters: failures + blocks") to a tooltip or help text, not the filter chip itself.
- Simplify badge language: "Human-approve" -> "Needs approval"; "SoD: maker-checker" -> show only on detail view.

---

### Screen: Project Overview

**What is currently there:**

- Header: "Project Overview" + subtitle "Project: Billing Governance" + CTAs ("Create Work Item", "View Work Items", "Context")
- 3-column metric cards: "Work Items needing attention: 7", "Runs in progress / failed (24h): 3 / 2", "Pending approvals: 4"
- 2-column grid: "Health and Risk" card (bar chart of execution tier distribution + callout) and "Quick Actions" card (2 runbook/workflow launch links)

**HCI Violations:**

| ID  | Heuristic             | Severity | Issue                                                                                                                                                                                                                        |
| --- | --------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | H1: Visibility        | Major    | Metrics show numbers without trend or context. "7 Work Items needing attention" -- is that good or bad? Up or down from yesterday? There is no baseline or sparkline to provide meaning.                                     |
| P2  | H8: Minimalist design | Minor    | The "Health and Risk" card contains an execution tier distribution bar chart. This is useful for admins but irrelevant for operators who need to see "what is broken right now." Persona adaptation is needed here.          |
| P3  | H2: Match real world  | Minor    | "Execution Tier distribution (effective)" is a label that requires domain knowledge. "Automation level" or "How work gets done" is more accessible.                                                                          |
| P4  | Task clarity          | Major    | The screen answers "what are the numbers?" but not "what should I do about it?" The metrics are not clickable/linked to filtered views. Clicking "7" should navigate to the Work Items list filtered to "needing attention." |
| P5  | H6: Recognition       | Minor    | "Quick Actions" duplicates the sidebar's "Quick Actions" section. Two "Quick Actions" areas creates confusion about which is canonical.                                                                                      |
| P6  | Gestalt: Proximity    | Minor    | The 3 metric cards and the 2 content cards are visually similar (same border, shadow, radius). Metrics should look distinct from content cards.                                                                              |

**Recommendations:**

- Make metric values clickable, linking to filtered lists.
- Add a single-sentence interpretation below each metric (e.g., "7 items need attention -- 3 are failing, 2 are blocked").
- Remove or rename the "Quick Actions" card to avoid duplication with the sidebar.
- Consider a different visual treatment for metrics (e.g., no border, larger type, colored background accent).

---

### Screen: Work Items

**What is currently there:**

- Header: "Work Items" + subtitle "Project: Billing Governance" + CTA "Create Work Item"
- Filter chips: "Assigned to me", "Unassigned", "Has pending approvals", "Has failed runs", "Port Family: PaymentsBilling"
- Table with columns: Title, Status, Tier, Owner, SoR Refs, Latest Run, Drift, Updated
- 4 rows of sample data with various statuses
- Empty state with explanation

**HCI Violations:**

| ID  | Heuristic             | Severity | Issue                                                                                                                                                                                                   |
| --- | --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | H2: Match real world  | Major    | The "SoR Refs" column header is pure jargon. "Linked Systems" or "Connected Apps" is immediately understandable.                                                                                        |
| W2  | H2: Match real world  | Minor    | "Port Family: PaymentsBilling" as a filter chip uses internal naming. "Category: Payments & Billing" is user-facing language.                                                                           |
| W3  | H6: Recognition       | Minor    | The "Drift" column is empty for 3 of 4 rows and shows a small "drift" badge for 1 row. An almost-always-empty column wastes space and provides low information scent.                                   |
| W4  | H8: Minimalist design | Minor    | 8 columns in the table is dense. "Tier" and "Drift" could be merged into the Status column or shown as secondary information.                                                                           |
| W5  | H7: Flexibility       | Minor    | No sort controls visible on table headers. Users expect column-header click-to-sort in data tables.                                                                                                     |
| W6  | Information scent     | Major    | Table rows link to `#work-item` (the detail screen) but only the first row has a drawer trigger. Inconsistent: some rows open drawers, others just navigate. Users cannot predict what a click will do. |
| W7  | H4: Consistency       | Minor    | The "SoR Refs" column uses chips with port-icon abbreviations (FA, PB, DM, CS) that are not explained anywhere on screen.                                                                               |

**Recommendations:**

- Rename "SoR Refs" to "Linked Systems" or "Connected Apps."
- Remove the "Drift" column and show drift as a badge on the Status column when present.
- Reduce to 6 core columns: Title, Status, Owner, Linked Systems, Latest Run, Updated.
- Add sort affordances to column headers.
- Make all rows consistently either navigate or open drawers (not a mix).
- Expand port-icon abbreviations to full names or add tooltips.

---

### Screen: Runs

**What is currently there:**

- Header: "Runs" + subtitle "Project: Billing Governance" + CTA "Start workflow"
- Filter chips: "All statuses", "Workflow: Invoice correction", "Last 24h", "Has pending approvals"
- Table with columns: Run, Status, Workflow, Work Item, Approvals, Initiator, Started
- 4 rows of sample data
- Empty state

**HCI Violations:**

| ID  | Heuristic       | Severity | Issue                                                                                                                                                                                        |
| --- | --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RN1 | H4: Consistency | Minor    | The CTA is "Start workflow" but it links to `#work-items`, not a workflow creation flow. This is misleading -- it suggests starting a workflow from this screen but actually navigates away. |
| RN2 | H1: Visibility  | Minor    | The "Approvals" column shows "1 pending" for one row and is empty for others. This important information is easy to miss in the table format.                                                |
| RN3 | H6: Recognition | Minor    | Run IDs ("R-8920") are opaque. The workflow name in the adjacent column provides context, but the Run column should perhaps show "R-8920: Invoice correction" as a combined label.           |
| RN4 | Task clarity    | Minor    | It is not clear what action a user should take from this list. Rows with "Failed" status should have an inline retry action or visual emphasis.                                              |

**Recommendations:**

- Highlight failed/paused runs with a tinted row background or left-border color accent.
- Add inline action buttons for retryable failed runs directly in the table row.
- Fix the "Start workflow" CTA to either start a workflow flow or change the label to "Go to Work Items."

---

### Screen: Work Item Detail

**What is currently there:**

- Breadcrumbs: Project / Work Items /
- Header: "WI-1099 Invoice correction for ACME" + tier badge + SoD badge + owner/status info
- CTAs: "Start workflow/runbook", "Attach ExternalObjectRef", "Context"
- Policy callout (dashed border)
- Linked External Records card (3 chips with port icons)
- Tab bar: Timeline, Runs, Approvals, Evidence
- Timeline tab: 3 events with status badges
- Effects card: Planned Effects + Verified Effects (not yet available)

**HCI Violations:**

| ID  | Heuristic                | Severity | Issue                                                                                                                                                                                                                                                   |
| --- | ------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WD1 | H8: Minimalist design    | Critical | The header packs title + tier badge + SoD badge + owner + status into one dense block. Combined with the policy callout, linked records card, tab bar, and effects card, the screen has 6+ distinct content zones above the fold. This is overwhelming. |
| WD2 | H2: Match real world     | Major    | "Attach ExternalObjectRef" is a button label that uses an internal domain model name. No user thinks in terms of "ExternalObjectRef." "Link external record" or "Connect system record" is human language.                                              |
| WD3 | H6: Recognition          | Major    | The tab bar (Timeline, Runs, Approvals, Evidence) provides no count badges. Users cannot see at a glance whether there are pending approvals or how many runs exist without clicking each tab.                                                          |
| WD4 | H3: User control         | Minor    | Breadcrumbs end with a trailing "/" which looks unfinished. The current page title should appear in the breadcrumbs.                                                                                                                                    |
| WD5 | Gestalt: Proximity       | Minor    | The policy callout, linked records card, tab bar, and effects card are all separated by identical 12px margins. There is no visual grouping to indicate which elements are related.                                                                     |
| WD6 | H2: Match real world     | Minor    | "Portarium intends to..." as the planned effects intro text is odd -- it personifies the software. "This workflow will..." or "Planned changes:" is more natural.                                                                                       |
| WD7 | H1: Visibility           | Major    | The Effects section is below the tabs, so when viewing the Runs or Approvals tab, effects are invisible. Effects are critical context for approval decisions and should be always visible or more prominently placed.                                   |
| WD8 | Information architecture | Major    | This screen tries to be both a summary hub AND a detail view. The tab content competes with the always-visible effects card. The hierarchy of "what is summary vs. what is drill-down" is unclear.                                                      |

**Recommendations:**

- Simplify the header: move the tier badge and SoD badge into a collapsible "Policy" section.
- Rename "Attach ExternalObjectRef" to "Link external record."
- Add count badges to tabs: "Approvals (1)", "Runs (1)", "Evidence (12)."
- Fix breadcrumbs to include the current page: "Project / Work Items / WI-1099."
- Move the Effects section inside the Timeline tab or create a dedicated "Plan & Effects" tab.
- Group related elements with visual containers or increased spacing.

---

### Screen: Run Detail

**What is currently there:**

- Breadcrumbs: Work Items / WI-1099 / Runs /
- Header: "Run R-8920 (Paused at Approval Gate)" + tier badge + workflow/initiator info
- CTAs: Retry, Export run summary, Context
- Outcome preview: "Retry will re-queue the Run..."
- Step indicators: Queued -> Running -> Approval Gate (active) -> Complete
- 2-column grid: Plan + Effects card (left) and Approval Gate card (right)
- Evidence card below the grid

**HCI Violations:**

| ID  | Heuristic              | Severity | Issue                                                                                                                                                                                                                                                                                                           |
| --- | ---------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RD1 | H8: Minimalist design  | Critical | The Approval Gate card contains: policy evaluation callout, SoD danger callout, prior decisions section, decision form (select + textarea), submit button, "Back to Work Item" link, and outcome preview. This is 7 distinct content sections within one card. The card needs to be broken into a clearer flow. |
| RD2 | H5: Error prevention   | Major    | The decision form defaults to "Approve" in the select dropdown. Default-to-approve is dangerous for a governance tool. The dropdown should default to a placeholder like "Select decision..." to force an explicit choice.                                                                                      |
| RD3 | H1: Visibility         | Major    | The "outcome preview" at the bottom of the approval form ("After approval: Run will resume automatically...") is critical information that should be shown BEFORE the decision, not after the submit button. Users need to understand consequences before acting.                                               |
| RD4 | H3: User control       | Minor    | The "Retry" button in the header has an outcome preview text below it, but this text is outside the button's visual container and easy to miss.                                                                                                                                                                 |
| RD5 | Progressive disclosure | Major    | The Plan + Effects card shows Planned, Predicted, AND Verified effects all at once. Verified effects show "Not available yet" with muted styling. Showing unavailable sections adds clutter. Hide them until they have content.                                                                                 |
| RD6 | H2: Match real world   | Minor    | "Confidence: 0.82" on predicted effects is a raw number. "High confidence" or a visual indicator (progress bar) is more accessible.                                                                                                                                                                             |
| RD7 | Task clarity           | Major    | If the user is an Operator (not an Approver), the approval form is still visible. The form should be contextually shown based on whether the current user can act on it (persona/RBAC).                                                                                                                         |

**Recommended Layout:**
The Run Detail screen should follow a linear decision-making flow when an approval gate is active:

1. **Step 1: Understand** -- Show the plan and effects prominently.
2. **Step 2: Review context** -- Show policy evaluation and SoD constraints.
3. **Step 3: Decide** -- Show the decision form with consequences preview ABOVE the submit button.
4. **Step 4: Confirm** -- Show what will happen after submission.

This linear flow is more natural than the current 2-column layout which forces the user to split attention between "what" (left) and "decide" (right).

---

### Screen: Approvals

**What is currently there:**

- Header: "Approvals" + subtitle "Queue and history of Approval Gates" + "Back to Inbox" button
- Filter chips: "Assigned to me", "Project: Billing Governance", "Status: Pending"
- Table: Approval Gate, Work Item, Run, Tier, SoD, Requested, Action
- 2 rows with "Review + decide" action buttons
- Outcome preview: "After deciding, the queue advances to the next pending gate."
- Focused Review card: plan summary for WI-1099 / R-8920

**HCI Violations:**

| ID  | Heuristic             | Severity | Issue                                                                                                                                                                                                                                                                                                       |
| --- | --------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | H4: Consistency       | Major    | The screen shows both a table of approvals AND a "Focused Review" card below it. This creates two interaction patterns: users can either click "Review + decide" in the table (which navigates to Run Detail) OR scroll down to see the focused review inline. Dual paths for the same action is confusing. |
| A2  | H8: Minimalist design | Minor    | The "SoD" column in the table is empty for some rows and shows "maker-checker" for others. Consider merging this into the Tier column or showing it as a badge only when present.                                                                                                                           |
| A3  | H7: Flexibility       | Major    | There is no way to approve/deny directly from this screen. Every approval requires navigating to the Run Detail page. For approvers processing a queue, this creates excessive navigation overhead. An inline decision flow (expand row or modal) would be more efficient.                                  |
| A4  | Task clarity          | Minor    | The subtitle "Queue and history" implies both pending and resolved approvals, but the current table only shows pending items. There should be a clear toggle between "Pending" and "Resolved" views.                                                                                                        |
| A5  | H6: Recognition       | Minor    | The "Focused Review" card title "Focused Review: WI-1099 / R-8920" assumes the user knows which approval this relates to. It should be contextually linked to a table row selection.                                                                                                                        |

**Recommendations:**

- Remove the static "Focused Review" card. Instead, make table rows expandable to reveal the plan summary and decision form inline. This creates a master-detail flow within the Approvals screen.
- OR: implement the focused review as a right-panel drawer that opens when a row is selected.
- Add tabs or toggle: "Pending" vs "History" to separate active queue from decided items.
- Allow inline approve/deny for simple cases to reduce navigation steps.

---

### Screen: Evidence

**What is currently there:**

- Header: "Evidence" + subtitle "Explore and verify hash-chained evidence entries" + CTAs (Export verification report, Export evidence bundle, Context)
- Filter chips: Category, Actor, Linked, Project
- Chain integrity banner (green): "Chain integrity: verified for entries 120 to 146..."
- List of 5 evidence entries with: title, category/actor/timestamp, retention tag, and "Verified" status badge
- Linked Objects card: 3 canonical object cards (Invoice, Charge, Ticket)

**HCI Violations:**

| ID  | Heuristic             | Severity | Issue                                                                                                                                                                                                                                           |
| --- | --------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | H2: Match real world  | Major    | The entire screen is written in audit/compliance language: "hash-chained evidence entries," "chain integrity," "contiguous," "retention expiry." An auditor may understand this, but operators and approvers visiting this screen will be lost. |
| E2  | H8: Minimalist design | Minor    | Every evidence entry has a "Verified" badge, making the badges meaningless (they all say the same thing). Only show verification status when it differs from the norm (e.g., show a warning for unverified entries).                            |
| E3  | H1: Visibility        | Minor    | The retention tags ("active 365d", "approaching expiry 30d", "payload purged") are small (10px font) and easy to miss. The "approaching expiry" tag is important and should be more prominent.                                                  |
| E4  | H6: Recognition       | Minor    | Evidence entry titles are prefixed with "EvidenceEntry:" which is redundant on the Evidence screen. "Approval decision submitted" is sufficient.                                                                                                |
| E5  | Information scent     | Minor    | Clicking an evidence entry opens the drawer, but this is only apparent for the first two entries (which have `js-drawer-trigger` class). The last 3 entries are not clickable (`row--static`). This inconsistency reduces trust in the UI.      |
| E6  | Gestalt: Continuity   | Minor    | The list does not visually convey the "chain" concept that the integrity banner references. A vertical timeline line connecting entries would reinforce the chain metaphor.                                                                     |

**Recommendations:**

- Add plain-language intro text: "This is a record of everything that happened, in order. Each entry is cryptographically linked to the previous one, so the record cannot be tampered with."
- Remove "EvidenceEntry:" prefix from titles.
- Only show "Verified" badges when verification status varies. If all are verified, show a single banner (already done) and remove per-row badges.
- Make ALL evidence entries consistently clickable (drawer or detail view).
- Add a visual timeline connector (left border or vertical line) to reinforce the chain concept.

---

### Screen: Settings

**What is currently there:**

- Header: "Workspace Settings" + subtitle "RBAC, credential vaulting, adapters/providers, and policies"
- 2-column grid with 4 cards: RBAC (user list), Credentials (credential list with expiry), Adapters/Providers (port family list + capability matrix table for Stripe), Policies (rule list)

**HCI Violations:**

| ID  | Heuristic                | Severity | Issue                                                                                                                                                                                                     |
| --- | ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ST1 | H8: Minimalist design    | Critical | The Settings screen is a single page with 4 dense cards plus a full capability matrix table. This is far too much content for one screen. Each card should be a separate sub-page or expandable section.  |
| ST2 | H5: Error prevention     | Major    | "Add user," "Add credential," "Rotate," "Select provider," "Register adapter," and "Create rule" are all destructive or high-impact actions placed directly on the page with no confirmation flows shown. |
| ST3 | H2: Match real world     | Minor    | "Credential vaulting," "adapters/providers," "scoped issuance" in the subtitle are implementation terms. "Users & Roles," "API Keys," "Connected Systems," "Rules" is more accessible.                    |
| ST4 | H8: Minimalist design    | Major    | The Capability Matrix Grid (Stripe) is shown inline on the settings page. This is reference information that should be behind a "View capabilities" link or expandable section, not always visible.       |
| ST5 | H6: Recognition          | Minor    | The Policies list does not explain what each tier means. The tier badges (Auto, Assisted, Human-approve, Manual-only) are used without definition. A legend or tooltip would help.                        |
| ST6 | Information architecture | Major    | Settings mixes configuration (RBAC, credentials, adapters) with governance rules (policies). These serve different mental models and user needs. They should be separate sections or tabs.                |

**Recommendations:**

- Replace the 4-card grid with a vertical tabbed or accordion layout (Settings > Users & Roles, Settings > API Keys, Settings > Connected Systems, Settings > Rules).
- Hide the capability matrix behind an expand/disclosure control.
- Add confirmation dialogs for all mutation actions.
- Separate "Configuration" (RBAC, credentials, adapters) from "Governance" (policies, tiers, SoD constraints).

---

## Cross-Cutting Issues

### Navigation and Wayfinding

1. **Flat hierarchy problem:** The sidebar treats Inbox, Project Overview, Work Items, Runs, Approvals, Evidence, and Settings as equal peers. But they are NOT equal: Inbox and Settings are workspace-level, while Work Items/Runs/Approvals/Evidence are project-scoped. This creates confusion about scope.

2. **No breadcrumb consistency:** Detail screens (Work Item Detail, Run Detail) have breadcrumbs, but list screens do not. The breadcrumb format varies: "Project / Work Items /" vs "Work Items / WI-1099 / Runs /".

3. **"Back" navigation is ad-hoc:** The Approvals screen has a "Back to Inbox" button in the header. Run Detail has "Back to Work Item" in the approval form. There is no consistent back-navigation pattern.

4. **Drawer competes with navigation:** Clicking some elements opens a drawer AND navigates (e.g., `.js-drawer-trigger` with an `href`). This dual behavior violates the principle of least surprise.

### Language and Copy

1. **Jargon density:** The prototype uses 15+ domain-specific terms on primary surfaces: ExternalObjectRef, SoR, Port Family, SoD, maker-checker, idempotency key, hash-chained, execution tier, capability matrix, adapter, provider, canonical object, retention tag, drift, branded type. A glossary helps documentation, but the UI itself should use plain language.

2. **Inconsistent naming:** The same concept is referred to differently in different places:
   - "Start workflow" vs "Start workflow/runbook" vs "Start runbook"
   - "Review + decide" vs "Submit decision" vs "Review and approve Plan"
   - "SoR Refs" vs "Linked External Records" vs "External Records" vs "SoR Ref Cluster"

3. **Copy is descriptive, not directive:** Labels describe what things ARE rather than what the user should DO. "Pending Approval Gates" should be "Approve these items." "Run Failures" should be "Fix these failures." Action-oriented copy reduces cognitive load.

### Consistency Problems

1. **Badge overload:** There are 7+ badge types: status badges, tier badges, port icons, SoD badges, idempotency badges, drift badges, retention tags. Each has a different shape, color scheme, and border style. This creates a "badge soup" effect where no single badge stands out.

2. **Interaction inconsistency:** Some list rows are links (navigate on click), some are static, some open drawers, and some do both. Users cannot predict what clicking a row will do.

3. **Action button placement:** Primary actions appear in screen headers, inside cards, inline in list rows, and in the sidebar. There is no consistent rule for where to find the main action for the current context.

### Information Architecture

1. **Missing conceptual onboarding:** There is no "Getting Started" or "What is this?" entry point. New users arrive at the Inbox with no mental model of the system.

2. **Scope confusion:** The prototype mixes workspace-level concerns (Settings, RBAC, credentials) with project-level concerns (Work Items, Runs, Evidence) without clear scope indicators.

3. **Redundant surfaces:** The Inbox, Project Overview, and sidebar Quick Actions all provide "start workflow" entry points. Approvals are accessible from the Inbox, the sidebar nav, and the Work Item Detail tabs. This redundancy is intended for convenience but creates "where do I go?" confusion.

---

## Prioritized Action Items

### Critical (Must Fix)

1. **Add guided task prompts to each screen.** At the top of every screen, add a prominent hero section that answers "What should I do here?" in plain language with a single primary CTA. On the Inbox, this replaces the current next-action bar. On Work Item Detail, this summarizes the current state and recommended action. Implementation: add a `.hero-prompt` component above the existing content with larger font size (18px), a distinct background color, and a single primary button.

2. **Fix the approval form default.** Change the Decision `<select>` from defaulting to "Approve" to having a disabled placeholder option: `<option value="" disabled selected>Select decision...</option>`. This prevents accidental approval. File: `index.html`, line 932-936.

3. **Establish visual hierarchy through weight differentiation.** Currently all cards use `border: 2px solid var(--line)` and `box-shadow: var(--shadow)`. Create 3 visual tiers:
   - **Primary/hero:** 2px border, shadow, slight background tint
   - **Standard:** 1px border, no shadow
   - **Subtle/metadata:** dashed or dotted border, no shadow, muted background

   Apply primary styling to the main actionable element on each screen. Apply subtle styling to metadata and reference sections. File: `wireframe.css`.

4. **Reduce Inbox to a single prioritized list.** Replace the 2-column card grid with a single vertical list of items sorted by priority. Each item shows: type icon (left), title + subtitle (center), status badge (right), and action button (far right). Persona controls which items appear first but does not hide categories entirely. This is a significant HTML restructure of the `#screen-inbox` section.

5. **Simplify Settings into sub-sections.** Replace the 4-card 2-column grid with a vertical layout of collapsible sections or a left-side sub-navigation. Hide the Capability Matrix behind an expand control. Move the "Policies" section to its own sub-page or prominent tab.

### Major (Should Fix)

6. **Replace jargon on primary surfaces.** Specific renames:
   - "ExternalObjectRef" / "SoR Refs" -> "Linked records" or "Connected systems"
   - "Port Family" -> "Category" or "Integration type"
   - "SoD: maker-checker" -> "Requires different approver" (show on detail views only)
   - "Execution Tier" -> "Automation level"
   - "hash-chained evidence" -> "tamper-proof audit log"
   - "Capability Matrix" -> "Supported operations"
   - "Attach ExternalObjectRef" button -> "Link external record"

   Keep technical terms in drawer/detail views for power users.

7. **Add count badges to sidebar navigation.** Each nav item should show a count of actionable items: "Inbox (5)", "Approvals (2)", "Work Items (7)". Implementation: add a `<span class="nav__badge">` element inside each `.nav__item`. CSS: position absolute right, pill shape, bold, matching the status badge style.

8. **Add count badges to Work Item Detail tabs.** "Runs (1)", "Approvals (1)", "Evidence (12)". Implementation: modify tab button text in `index.html` lines 675-678.

9. **Fix the outcome preview placement on Run Detail.** Move the "After approval: Run will resume automatically..." text ABOVE the "Submit decision" button, not below it. The user needs to understand consequences before committing to an action. File: `index.html`, lines 946-953 -- move the `.outcome-preview` div before `.form__actions`.

10. **Make evidence entries consistently interactive.** All evidence rows should be clickable (open drawer or navigate). Remove the inconsistency where some rows have `js-drawer-trigger` and others are `row--static`. File: `index.html`, evidence list section.

11. **Style sidebar navigation as a flat list.** Remove borders and shadows from `.nav__item`. Use left-border highlight for active state, subtle background on hover. This matches established sidebar conventions. File: `wireframe.css`, lines 192-203.

12. **Add icons to sidebar navigation items.** Even lo-fi placeholder text icons (e.g., "[!] Inbox", "[#] Work Items", "[>] Runs") would improve scanability and recognition. File: `index.html`, sidebar nav section.

### Minor (Nice to Fix)

13. **Remove grid-paper background.** The `background-image` with linear gradients on `body` reinforces "this is a draft wireframe" and adds visual noise. Replace with a flat `var(--bg)` background. File: `wireframe.css`, lines 47-50.

14. **Fix breadcrumb consistency.** Add breadcrumbs to all screens (not just detail views). Include the current page name. Ensure consistent format: "Workspace / Project / Work Items / WI-1099". File: `index.html`, all screen headers.

15. **Collapse the "Verified Effects: Not available yet" section.** Instead of showing a muted placeholder, hide the section entirely and show a note: "Verified effects will appear after the run completes." File: `index.html`, effects sections.

16. **Add a legend for tier badges.** On screens where tier badges appear (Work Items table, Project Overview), add a subtle legend or tooltip explaining Auto / Assisted / Human-approve / Manual-only. File: `index.html`, relevant screens.

17. **Make metric cards clickable.** On Project Overview, clicking "7" for "Work Items needing attention" should navigate to Work Items filtered to needing attention. File: `index.html`, lines 342-354 -- wrap metric content in anchor tags.

18. **Add a "Getting Started" empty state.** When a workspace is truly new (no projects, no work items), show a guided onboarding flow rather than the current empty state. The current empty state explains domain concepts but does not guide the user through first-time setup.

19. **Reduce badge variety.** Consolidate from 7+ badge types to 3: status badges (colored pill), metadata badges (muted outline), and action badges (link style). Maintain color semantics (ok/warn/danger/info) but unify shapes and sizes.

20. **Separate prototype controls visually.** Move the Persona/Workspace/State controls to a collapsible debug panel or a floating toolbar, so they are clearly not part of the production UI.

---

## Gestalt Principles Assessment

| Principle         | Current State                                                                    | Issues                                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Proximity**     | Weak. All elements have uniform 12px gaps.                                       | Related items (e.g., title + status, plan + effects) are not visually grouped more tightly than unrelated items.                                                          |
| **Similarity**    | Weak. Cards, rows, badges, and chips all share the same border style and radius. | Users cannot distinguish interactive elements from static ones, or primary elements from secondary ones.                                                                  |
| **Continuity**    | Missing.                                                                         | The evidence "chain" concept has no visual continuity affordance. Timelines lack connecting lines. Step indicators use discrete pills without connecting arrows or lines. |
| **Closure**       | Adequate.                                                                        | Cards and tables have clear boundaries.                                                                                                                                   |
| **Figure-Ground** | Weak.                                                                            | The grid-paper background, white cards, and white badges all compete. There is insufficient contrast between "background" and "content."                                  |

---

## Summary

The Portarium cockpit prototype has a solid architectural foundation: correct IA, good persona adaptation, proper semantic HTML, and comprehensive domain coverage. The core UX problem is **presentation, not structure**. The information is all there, but it is presented with uniform weight, dense jargon, and insufficient progressive disclosure.

The user reaction "I don't get it" is primarily caused by:

1. No clear visual entry point or task guidance per screen
2. Every element looking equally important
3. Domain language that requires pre-existing knowledge

The recommended approach is to **layer the existing information** rather than remove it: lead with plain-language task guidance and single primary CTAs, use visual hierarchy to direct attention, and progressively disclose technical details for power users.
