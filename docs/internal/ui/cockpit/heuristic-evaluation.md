# Cockpit Prototype: Heuristic Evaluation Report

**Date**: 2026-02-18
**Evaluators**: UX/UI Design Expert, HCI Specialist, Usability Engineer
**Framework**: Jakob Nielsen's 10 Usability Heuristics + additional HCI criteria
**Artifact**: Lo-fi HTML/CSS/JS prototype — 11 screens, keyboard-first, persona-adaptive
**Screenshots**: `docs/internal/ui/cockpit/screenshots/01–11-*.png`

---

## Executive Summary

The cockpit prototype demonstrates strong fundamentals: clear information hierarchy, consistent layout patterns, good use of progressive disclosure, and a keyboard-first interaction model. The hero prompts on every screen provide excellent onboarding context. However, several usability issues were identified across the 10 heuristics — most are severity 2 (minor) or 3 (major), with no severity 4 (catastrophic) issues found.

**Overall score**: 7.2 / 10 (Good — above average for a lo-fi prototype at this stage)

### Severity Scale

- **0**: Not a usability problem
- **1**: Cosmetic only — fix if time allows
- **2**: Minor — low priority
- **3**: Major — important to fix, high priority
- **4**: Catastrophic — must fix before release

---

## H1: Visibility of System Status

**Score: 7/10**

### Strengths

- Status bar at bottom shows live system health (Runs active, Chain verified, Events connected) — excellent ambient awareness
- Badge counts on sidebar nav items (Inbox 5, Work Items 7, Approvals 2, Agents 1) provide at-a-glance workload
- Status badges on runs (Paused, Running, Failed, Succeeded) use color + text — good redundant coding
- Persona mode indicator (bottom-left dashed box) tells user their current context
- Kanban columns show counts (1) per status

### Issues

| #   | Issue                                                                                                                                                                                   | Screen(s)                        | Severity | Recommendation                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| 1.1 | **No loading/progress indicators for actions**. "Retry run", "Submit decision", "Start workflow" buttons give no feedback after click. User has no indication the system is processing. | Inbox, Run Detail, Approvals     | **3**    | Add a spinner or "Processing..." state on action buttons. Disable button during async operation.         |
| 1.2 | **Triage progress bar position is below the fold**. The "1 of 2 pending" counter and progress bar on Approvals are separated from the triage card by the table — users may not see it.  | Approvals                        | **2**    | Move progress indicator to top of triage section, or make it sticky.                                     |
| 1.3 | **No timestamp on Evidence entries relative to "now"**. Entries show `occurredAt: 2026-02-17T00:20Z` but no relative time like "1 day ago".                                             | Evidence                         | **2**    | Add relative timestamps alongside ISO timestamps (e.g., "1 day ago").                                    |
| 1.4 | **No breadcrumb on Inbox, Project Overview, or list screens**. Only detail screens show breadcrumbs. User on Runs screen doesn't see their position in the hierarchy.                   | Inbox, Project, Work Items, Runs | **1**    | Consider a lightweight breadcrumb or "You are here" indicator on list screens.                           |
| 1.5 | **Credential expiry ("Expiring" badge on NetsSync OAuth) has no urgency signal**. The orange "Expiring" badge on Settings is subtle — no countdown, no alert banner.                    | Settings                         | **2**    | Add expiry countdown ("Expires in 25 days") and surface expiring credentials in Inbox as a notification. |

---

## H2: Match Between System and the Real World

**Score: 8/10**

### Strengths

- Jargon cleanup is thorough — "Requires different approver" instead of "SoD: maker-checker", "tamper-proof audit log" instead of "hash-chained evidence entries"
- Hero prompts use plain, task-oriented language ("Track execution history", "Review the execution state")
- Filter chips use human-readable labels ("Assigned to me", "Has pending approvals")
- Workflow Builder uses spatial/visual metaphor (flowchart) matching mental model

### Issues

| #   | Issue                                                                                                                                                                                       | Screen(s)                                | Severity | Recommendation                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | **"Automation level" still uses tier names (Human-approve, Auto, Assisted, Manual)** without explaining what each means. New users won't know the difference between "Auto" and "Assisted". | Project Overview, Run Detail, WF Builder | **3**    | Add tooltips or an info icon with brief descriptions. E.g., Auto = "Runs without human intervention", Assisted = "AI helps but human reviews". |
| 2.2 | **"retry-safe" badge lacks context**. What does retry-safe mean to an operator? Why should they care?                                                                                       | Inbox, Work Item Detail, Run Detail      | **2**    | Change to "Safe to retry" with tooltip: "Retrying this action won't create duplicates".                                                        |
| 2.3 | **"at-most-once" badge on Approval Gate opened** is technical.                                                                                                                              | Work Item Detail                         | **2**    | Replace with "One-time action" or "Non-repeatable".                                                                                            |
| 2.4 | **Evidence metadata format is raw**. "payloadRefs: Diff, Log" and "active 365d" are developer-facing strings, not user-facing.                                                              | Evidence                                 | **2**    | Rewrite as "Attachments: Diff, Log" and "Retained for 1 year".                                                                                 |
| 2.5 | **"FA", "PB", "CS", "DM" abbreviation badges** on linked records are cryptic without legend.                                                                                                | Work Item Detail, Evidence, WF Builder   | **3**    | Use full provider names or show tooltip on hover. At minimum, add a legend or use recognizable icons.                                          |

---

## H3: User Control and Freedom

**Score: 7/10**

### Strengths

- AB toggle (Cards/Matrix, Table/Kanban, Summary/Dashboard) gives users layout choice
- Persona switcher in top bar allows role exploration
- "Back to Inbox" and "Back to Work Item" buttons on detail screens
- Breadcrumbs on detail screens enable non-linear navigation
- Undo/Redo buttons on Workflow Builder

### Issues

| #   | Issue                                                                                                                                                                 | Screen(s)                         | Severity | Recommendation                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| 3.1 | **No undo for approval decisions**. "Submit decision" on Run Detail is irreversible — no confirmation dialog, no "Are you sure?" for a high-stakes governance action. | Run Detail, Approvals             | **3**    | Add confirmation modal: "You are about to [Approve/Reject] this plan. This action cannot be undone. Continue?" |
| 3.2 | **No undo for "Retry run" action**. Clicking Retry on Inbox immediately re-queues the run with no confirmation.                                                       | Inbox                             | **2**    | Add brief confirmation or make the button two-stage (click → "Confirm retry?").                                |
| 3.3 | **Triage mode has no "skip" or "come back later" action**. User is forced into Approve/Reject/Delegate for each card — no way to defer.                               | Approvals (Triage)                | **3**    | Add a "Skip" or "Defer" swipe action to the triage card.                                                       |
| 3.4 | **No way to dismiss the hero prompt banner** after the user has seen it multiple times. It takes significant vertical space.                                          | All screens                       | **2**    | Add a dismiss (x) button or "Got it" link. Remember dismissal in sessionStorage per screen.                    |
| 3.5 | **Filter chips cannot be cleared with one click**. No "Clear all filters" button visible.                                                                             | Inbox, Work Items, Runs, Evidence | **2**    | Add a "Clear all" chip or (x) on each active filter.                                                           |

---

## H4: Consistency and Standards

**Score: 8/10**

### Strengths

- Consistent card-based layout across all screens
- Consistent header pattern: Title + subtitle + hero prompt + filters + content
- Consistent button styling: primary (black fill), secondary (outline), ghost (text only)
- Consistent badge color coding: green=success, red=failure, orange=warning, blue=info
- Status bar and sidebar are persistent across all screens

### Issues

| #   | Issue                                                                                                                                                                                                                                                                                                                                                                                                                   | Screen(s)                              | Severity | Recommendation                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | **Inconsistent primary action button placement**. Inbox has "Start workflow" top-right. Runs has "Start workflow" top-right. But Run Detail has "Retry" and "Export" top-right with "Submit decision" bottom-right. Mixed position for the most important action.                                                                                                                                                       | Run Detail vs others                   | **2**    | Primary action should always be in a consistent location. Consider a sticky action bar at the bottom for detail-screen actions. |
| 4.2 | **Mixed card border treatments**. Some cards have solid borders, some dashed (card--subtle), some thicker borders (card--hero). While intentional for hierarchy, the three levels may confuse users about interactivity — "Can I click the dashed ones?"                                                                                                                                                                | Project Overview, Settings, Run Detail | **1**    | Ensure dashed border doesn't imply "placeholder" or "droppable". Consider using opacity/background color for hierarchy instead. |
| 4.3 | **Tab styling inconsistency**. Work Item Detail tabs (Timeline, Runs, Approvals, Evidence) use rounded pill-style tabs. Settings uses the same style. But Workflow Builder detail panel (Configuration, Usage, Integrations) on Agents looks identical — no issue. However, Run Detail uses phase tabs (Queued, Running, Approval Gate, Complete) that look like tabs but represent process stages, not content panels. | Run Detail                             | **2**    | Differentiate process-stage indicators (stepper/progress) from content tabs. Use a stepper pattern for run phases.              |
| 4.4 | **"Context" button appears on some screens but not others** (Inbox, Work Item Detail, Run Detail, Evidence have it; Runs, Work Items, Project do not).                                                                                                                                                                                                                                                                  | Various                                | **1**    | Either add Context to all screens or clarify what screens warrant it.                                                           |

---

## H5: Error Prevention

**Score: 6/10**

### Strengths

- Approval Gate shows policy evaluation context before decision
- "Requires different approver" badge prevents self-approval confusion
- "retry-safe" badges on actions clarify idempotency
- Workflow Builder has Undo/Redo and Save Draft

### Issues

| #   | Issue                                                                                                                                                                                          | Screen(s)            | Severity | Recommendation                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| 5.1 | **Approval decision dropdown defaults to "Select decision..."** with no guard against accidental submission of empty decision. The "Rationale (required)" textarea has no enforcement visible. | Run Detail           | **3**    | Disable "Submit decision" until both decision is selected AND rationale has >10 characters. Show inline validation. |
| 5.2 | **"Deactivate" button for agents has no confirmation**. Deactivating an agent in production workflows could break running processes.                                                           | Agents               | **3**    | Add confirmation: "This agent is used in X active workflows. Deactivating it may cause failures. Continue?"         |
| 5.3 | **No warning when editing Workflow Builder with running instances**. If a workflow has active runs and the user modifies the draft, there's no indication this could affect in-flight work.    | Workflow Builder     | **2**    | Show a warning banner: "This workflow has 3 active runs. Changes will only apply to new runs."                      |
| 5.4 | **Credential rotation ("Rotate" button on Settings) has no safety check** — rotating a credential while workflows are running could cause failures.                                            | Settings             | **3**    | Add confirmation with impact analysis: "2 workflows use this credential. Rotation will require reconfiguration."    |
| 5.5 | **No duplicate run prevention visible**. If user clicks "Start workflow" twice rapidly, could it create two runs?                                                                              | Inbox, Project, Runs | **2**    | Disable button after click with "Starting..." state, re-enable after confirmation.                                  |

---

## H6: Recognition Rather Than Recall

**Score: 8/10**

### Strengths

- Hero prompts on every screen explain the screen's purpose — reduces learning curve
- Filter chips show current active filters visibly
- Work Item Detail shows full context (badges, linked records, policy) without needing to navigate away
- Approval triage card shows full plan effects inline — reviewer doesn't need to open another screen
- Persona mode box describes the current persona's priorities

### Issues

| #   | Issue                                                                                                                                                                                               | Screen(s)   | Severity                            | Recommendation                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| 6.1 | **Run IDs (R-8920, R-8850) are arbitrary identifiers**. Users must recall what R-8920 refers to. The Runs table helps (shows workflow name) but Inbox references just "R-8850" in the alert banner. | Inbox, Runs | **2**                               | Always pair Run ID with workflow name: "R-8850 (CRM sync)" instead of just "R-8850".                                   |
| 6.2 | **Work Item IDs (WI-1099, WI-1021) require recall** in linked contexts. The Runs table shows WI IDs but not the work item title.                                                                    | Runs        | **2**                               | Show work item title alongside or instead of the WI ID in table cells.                                                 |
| 6.3 | **Keyboard shortcuts are hidden**. The "? shortcuts" button in the bottom-right is subtle. New users won't discover the keyboard-first UX naturally.                                                | All screens | **2**                               | Show a first-visit tooltip or one-time onboarding overlay: "This app is keyboard-first. Press ? to see all shortcuts." |
| 6.4 | **Linked External Records use pipe-delimited format** ("NetSuite                                                                                                                                    | Invoice     | INV-22318") which requires parsing. | Work Item Detail, Evidence                                                                                             | **1** | Use hierarchical formatting: "NetSuite > Invoice > INV-22318" or structured layout with labels. |

---

## H7: Flexibility and Efficiency of Use

**Score: 8.5/10**

### Strengths

- Keyboard-first design with comprehensive shortcuts (Ctrl+K command palette, ? for help)
- AB toggle for layout preferences (Kanban vs Table, Cards vs Matrix)
- AI Summary toggle for approval analysis
- Triage mode for rapid approval processing
- Persona-adaptive content (Operator sees failures first, Approver sees approvals first)
- Quick Actions in sidebar for common tasks
- Filter chips for quick filtering

### Issues

| #   | Issue                                                                                                                                                   | Screen(s)                  | Severity | Recommendation                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| 7.1 | **No bulk actions on list screens**. User cannot select multiple runs to retry, or multiple work items to reassign. Must act one-by-one.                | Runs, Work Items           | **3**    | Add checkbox selection column with bulk action bar: "3 selected: Retry All / Export / Reassign".                 |
| 7.2 | **No saved/named filters**. Power users managing many workflows will want to save filter combinations (e.g., "My failed billing runs").                 | Runs, Work Items, Evidence | **2**    | Add "Save filter" option that persists named filter sets.                                                        |
| 7.3 | **Search bar placeholder says "Search work items, runs, evidence..."** but it's not clear if it actually does global search or just the current screen. | All screens (header)       | **1**    | Clarify search scope. If global, add scope indicators in results. If per-screen, change placeholder dynamically. |
| 7.4 | **No customizable dashboard**. Project Overview shows fixed cards (Health/Risk, Common Workflows). Power users may want to rearrange or add widgets.    | Project Overview           | **1**    | Consider a widget-based layout for future iterations. Low priority for prototype.                                |

---

## H8: Aesthetic and Minimalist Design

**Score: 7.5/10**

### Strengths

- Clean, professional lo-fi aesthetic — not over-designed
- Good use of whitespace in card layouts
- Consistent typography hierarchy (headers, subheaders, body, captions)
- Color is used meaningfully (status badges, not decoration)
- Hero prompts are visually distinct but not overwhelming

### Issues

| #   | Issue                                                                                                                                                                                                                                                  | Screen(s)        | Severity                                                               | Recommendation                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8.1 | **Inbox screen is visually dense**. Hero prompt + alert bar + filter chips + failures section + approvals section — all competing for attention above the fold. The hero prompt + alert + filters take ~40% of viewport before any actionable content. | Inbox            | **3**                                                                  | Make hero prompt dismissible. Consider combining the alert bar ("A run failed...") INTO the hero prompt rather than having both. Reduce visual layers.                                |
| 8.2 | **Run Detail is information-overloaded**. Plan + Effects card, Approval Gate card, phase tabs, breadcrumbs, action buttons, retry notice, hero prompt — too many elements competing simultaneously. Two-column layout splits attention.                | Run Detail       | **3**                                                                  | Consider a single-column layout with collapsible sections. Or use a step-by-step flow: "1. Review Plan → 2. Check Effects → 3. Make Decision" rather than showing everything at once. |
| 8.3 | **Evidence screen has dense metadata on each entry**. "Category: Approval                                                                                                                                                                              | Actor: User      | occurredAt: 2026-02-17T00:20Z (active 365d)" is a lot of text per row. | Evidence                                                                                                                                                                              | **2** | Use a compact two-line format: Title on line 1, metadata as small gray text on line 2. Move less-important fields into an expandable "details" row. |
| 8.4 | **Work Item Detail has too many tabs + cards + effects section below the fold**. The content below the tabs (Timeline, Runs, Approvals, Evidence) and the Effects section creates a very long scroll.                                                  | Work Item Detail | **2**                                                                  | The tab content + effects section should be mutually exclusive views, not stacked. Consider nesting the Effects section inside the Runs tab.                                          |
| 8.5 | **Workflow Builder right panel (step configuration) competes with the canvas**. The form fields (Automation Level, Required Approvers, etc.) take significant horizontal space.                                                                        | Workflow Builder | **1**                                                                  | Consider a slide-out panel or modal for step configuration to give more canvas space.                                                                                                 |

---

## H9: Help Users Recognize, Diagnose, and Recover from Errors

**Score: 6.5/10**

### Strengths

- "Run failed: CRM sync hit rate limit" — clear error message with cause
- "Recommended: retry after rate limit window expires" — actionable guidance
- "Retry will re-queue the Run. This retry is safe — no duplicate actions will occur" — explains consequence
- Policy Validator agent shows "Connection failed: endpoint returned 502. Last checked 5m ago." — specific error

### Issues

| #   | Issue                                                                                                                                                             | Screen(s)        | Severity | Recommendation                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9.1 | **"Run blocked: missing provider scope" gives no recovery path**. What scope is missing? Which provider? How does the user fix it?                                | Inbox            | **3**    | Expand to: "Run blocked: the Stripe adapter needs `charges.write` scope. Go to Settings > Integrations to update permissions." Include a direct link. |
| 9.2 | **Agent "Error" state shows connection error but no fix action**. "Connection failed: endpoint returned 502" — what should the user do?                           | Agents           | **3**    | Add "Retry connection" button and suggest: "Check if the endpoint is accessible, or update the URL in Configuration."                                 |
| 9.3 | **No error states shown for form validation**. The approval decision form has "Rationale (required)" but no visual indication of what happens if submitted empty. | Run Detail       | **2**    | Show inline validation: red border + "Rationale is required (minimum 10 characters)" when user tries to submit without filling it.                    |
| 9.4 | **NetsSync OAuth "Expiring" badge has no remediation action**. User sees it but has to figure out what to do.                                                     | Settings         | **2**    | Add "Renew" button next to expiring credentials. Link to renewal flow.                                                                                |
| 9.5 | **No empty-state guidance**. What do screens show when there are zero work items, zero runs, or zero evidence entries?                                            | All list screens | **2**    | Design empty states with illustration + message + CTA: "No runs yet. Start your first workflow to see execution history here."                        |

---

## H10: Help and Documentation

**Score: 7/10**

### Strengths

- Hero prompts on every screen serve as inline contextual help
- Persona mode box explains the current role's priorities
- "Context" button available on key screens for deeper information
- Keyboard shortcut reference accessible via `?`
- Ctrl+K command palette for discoverability

### Issues

| #    | Issue                                                                                                                                                                                                             | Screen(s)                 | Severity | Recommendation                                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 10.1 | **No tooltips on badges or status indicators**. Badges like "Human-approve", "retry-safe", "Different-approver rule" lack hover explanations.                                                                     | All screens               | **3**    | Add tooltip on hover for every badge: what it means and why it matters.                                                         |
| 10.2 | **No contextual help on Workflow Builder step types**. The step palette (Action, Approval Gate, Condition, Notification, Agent Task) has one-line descriptions but new users may not understand when to use each. | Workflow Builder          | **2**    | Add (?) icon that expands to a brief guide or links to documentation for each step type.                                        |
| 10.3 | **Settings screen lacks explanations for governance concepts**. Automation levels, separation of duties, approval rules — these are domain-specific concepts that need inline definitions.                        | Settings (Governance tab) | **2**    | Add info icons (i) next to each concept with popover definitions.                                                               |
| 10.4 | **No onboarding flow or first-run experience**. Users land on Inbox with no introduction to the app's structure or key concepts.                                                                                  | First visit               | **2**    | Add an optional onboarding tour highlighting: sidebar navigation, persona switcher, keyboard shortcuts, and the Inbox workflow. |
| 10.5 | **"Ctrl+K palette" text in status bar is small and unexplained**. Power feature is poorly discoverable.                                                                                                           | All screens               | **1**    | On first visit, briefly pulse/highlight the Ctrl+K indicator or show a tooltip.                                                 |

---

## Additional HCI Criteria

### Accessibility (WCAG-adjacent)

| #   | Issue                                                                                                                                                                          | Severity | Recommendation                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------- |
| A.1 | **Color-only status differentiation**. Failed (red), Running (green), Paused (blue), Succeeded (green) — red/green colorblind users cannot distinguish Running from Succeeded. | **3**    | Add icons alongside color badges: checkmark for Succeeded, spinner for Running, X for Failed, pause icon for Paused. |
| A.2 | **Small badge text**. "retry-safe", "Requires different approver" badges use small text inside bordered boxes. May be hard to read at lower resolutions.                       | **2**    | Ensure minimum 12px font size for all badge text. Test at 1024x768.                                                  |
| A.3 | **Focus indicators not visible in screenshots** (may be present in CSS). Keyboard-first app must have clear focus outlines.                                                    | **3**    | Verify all interactive elements have visible `:focus` styles with 3:1 contrast against background.                   |
| A.4 | **No skip navigation link**. Keyboard users must tab through sidebar to reach main content.                                                                                    | **2**    | Add a visually-hidden "Skip to main content" link as the first focusable element.                                    |

### Cognitive Load

| #   | Issue                                                                                                                                                                                                                                                                                             | Severity | Recommendation                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C.1 | **Run Detail demands high cognitive load**. Users must simultaneously understand: plan effects (left column), predicted effects (left column), verified effects (left column), policy evaluation (right column), prior decisions (right column), and make their own decision — all on one screen. | **3**    | Implement a guided decision flow: Step 1: "Review what this workflow will do" → Step 2: "See the policy rules" → Step 3: "Make your decision". Progressive disclosure. |
| C.2 | **Evidence screen presents linear list of heterogeneous entries**. Approval decisions, adapter writes, plan records, gate openings all in one flat list. Users must mentally categorize.                                                                                                          | **2**    | Add grouping by category or a timeline visualization that clusters related evidence entries.                                                                           |

### Information Architecture

| #    | Issue                                                                                                                                                                                                                                                          | Severity | Recommendation                                                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| IA.1 | **Sidebar navigation mixes entity types**. "Inbox" (a view), "Project Overview" (a dashboard), "Work Items" (a list), "Workflow Builder" (a tool), "Settings" (configuration) are all siblings. No clear grouping beyond WORKSPACE/WORK/CONFIGURATION headers. | **1**    | The section headers help, but consider visual separators or indentation. Current implementation is adequate for the feature set. |
| IA.2 | **"Agents" sits under CONFIGURATION** but agents are operational entities (they run, have metrics, have errors). This is more WORK than CONFIGURATION.                                                                                                         | **2**    | Consider moving Agents to the WORK section, or creating a dedicated "AI" section.                                                |

---

## Priority Summary: Top 10 Fixes

Ranked by impact (severity x frequency across screens):

| Rank | Issue                                                                                         | Heuristic | Severity | Effort |
| ---- | --------------------------------------------------------------------------------------------- | --------- | -------- | ------ |
| 1    | **Add confirmation dialogs for irreversible actions** (approve, reject, deactivate, rotate)   | H3, H5    | 3        | Medium |
| 2    | **Add tooltips to all badges and status indicators**                                          | H10, H2   | 3        | Medium |
| 3    | **Reduce Run Detail cognitive overload** — guided decision flow                               | H8, C.1   | 3        | High   |
| 4    | **Add loading/processing feedback on action buttons**                                         | H1        | 3        | Low    |
| 5    | **Improve error recovery with actionable guidance** ("missing provider scope" → specific fix) | H9        | 3        | Medium |
| 6    | **Accessibility: add icons to color-coded status badges** for colorblind users                | A.1       | 3        | Low    |
| 7    | **Explain automation levels** (Auto/Assisted/Human/Manual) with tooltips                      | H2        | 3        | Low    |
| 8    | **Make hero prompts dismissible** to reduce visual density                                    | H3, H8    | 2→3      | Low    |
| 9    | **Add bulk actions on list screens** (multi-select retry, reassign)                           | H7        | 3        | High   |
| 10   | **Add form validation feedback** (approval decision, rationale)                               | H5, H9    | 2-3      | Low    |

---

## What's Working Well (Preserve These)

1. **Hero prompts** — Excellent onboarding pattern. Every screen self-describes.
2. **Persona-adaptive Inbox** — Surfaces what matters per role. Smart defaults.
3. **Kanban view for Work Items** — Clear visual status at a glance.
4. **AI Summary toggle** — Progressive disclosure of AI-generated insights.
5. **Triage mode** — Efficient approval workflow for batch processing.
6. **Keyboard-first design** — Ctrl+K palette, ?, and shortcut system.
7. **Workflow Builder visual canvas** — Intuitive flowchart mental model.
8. **Evidence chain integrity banner** — Builds trust with visible verification.
9. **Linked External Records** — Cross-reference to source systems is valuable.
10. **Status bar** — Ambient system health without consuming screen space.

---

## Methodology Note

This evaluation was conducted by reviewing static screenshots of all 11 screens in the Operator persona at 1440x900 viewport. A complete evaluation would additionally require:

- Testing with all 4 personas (Operator, Approver, Auditor, Admin)
- Testing error states and empty states
- Testing on mobile / smaller viewports
- Testing keyboard navigation flows end-to-end
- Testing with screen reader (NVDA/JAWS)
- A/B variant testing (Cards vs Matrix, Table vs Kanban, Summary vs Dashboard)
- User testing with 5+ representative users per persona
