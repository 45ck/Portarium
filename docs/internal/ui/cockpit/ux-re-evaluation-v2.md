# UX Re-Evaluation Report v2: Portarium Cockpit Lo-Fi Prototype

**Date:** 2026-02-17
**Auditor:** HCI Expert (Nielsen Heuristics, Gestalt, IA)
**Scope:** Post-redesign re-evaluation of all screens, shell components, and cross-cutting patterns
**Reference prototype:** `docs/internal/ui/cockpit/index.html`, `wireframe.css`, `wireframe.js`
**Prior audit:** `docs/internal/ui/cockpit/ux-audit-report.md`

---

## Executive Summary

The round 1 redesign addressed many of the most critical issues from the initial audit. The prototype has meaningfully improved in several areas:

### What Improved

1. **Hero task prompts** now appear on Inbox (line 171), Work Items (line 638), Project Overview (line 450), Approvals (line 1285), Workflow Builder (line 1968), and Agents (line 2275). These directly answer "What should I do here?" and were the single most impactful recommendation.
2. **Sidebar navigation was flattened** with icons (`nav__icon` elements, lines 76-106), badge counts (Inbox 5, Work Items 7, Runs 1, Approvals 2, Agents 1), and grouped sections (Workspace, Work, Configuration, Quick Actions). The left-border active indicator (`wireframe.css` line 207-211) follows standard sidebar conventions.
3. **Visual hierarchy tiers** were introduced (`card--hero`, `card--subtle`, `card--featured` in `wireframe.css` lines 1109-1119) though their application remains inconsistent (see below).
4. **Key jargon renames** landed: "SoR Refs" became "Linked Systems" (Work Items table header, line 679), "Port Family: PaymentsBilling" became "Category: Payments & Billing" (line 650), "Attach ExternalObjectRef" became "Link external record" (line 922), "Execution Tier distribution (effective)" became "Automation level distribution" (line 477).
5. **Approval form default fixed**: Decision dropdown now has `<option value="" disabled selected>Select decision...</option>` (line 1210), preventing accidental approval.
6. **Outcome preview placement fixed**: The outcome preview now appears ABOVE the submit button in the approval form (line 1224-1227), before the `form__actions` div (line 1228).
7. **AB variant toggle system** with sessionStorage persistence (wireframe.js lines 710-819) enables comparing alternative layouts (Inbox card grid vs priority matrix, Work Items table vs kanban, Project Overview metrics vs dashboard).
8. **Tinder-style triage UX** for approvals (lines 1350-1555) with keyboard shortcuts (A/D/R/S/Space), progress bar, card animations, and rationale enforcement for deny/changes.
9. **N8N-style workflow builder** (lines 1949-2258) with 3-panel layout (palette|canvas|config), node types with color-coded left borders, branching, connectors, and inline configuration.
10. **Agent configuration** master-detail panel (lines 2264-2600) with provider badges, stats, capabilities checkboxes, and cross-references to workflows.
11. **Work Item Detail tabs have count badges**: "Runs (1)", "Approvals (1)", "Evidence (12)" (lines 952-955).
12. **Grid-paper background removed**: `body` no longer has the `background-image` with linear gradients (wireframe.css line 46, now just `background-color: var(--bg)`).
13. **Search placeholder simplified**: "Search work items, runs, evidence..." (line 29) -- removed "SoR refs."

### What Remains Problematic

1. **Jargon persists in secondary surfaces** -- "SoD: maker-checker" badges, "EvidenceEntry:" prefixes, "hash-chained," "Correlation Context" drawer title, "SoR Ref Cluster" drawer sections, "idempotency key" in outcome previews.
2. **Evidence screen is essentially unchanged** from round 1 -- all the original issues remain.
3. **Settings screen is unchanged** -- still a dense 4-card 2-column grid with inline capability matrix.
4. **Drawer title and section headers still use domain jargon** despite being a high-visibility surface.
5. **Badge variety is unreduced** -- still 7+ distinct badge types with different shapes and colors.
6. **Status bar is unchanged** -- still uses "Chain: verified" instead of "Audit log: OK."

### New Issues Introduced

1. **Triage rationale submit dispatches wrong action** (JS bug) -- deny + rationale submit calls `triageAction('skip')` instead of completing the deny.
2. **AB toggle buttons injected without explanation** -- users see cryptic "A|B" pills with no label or tooltip explaining what layout variants are.
3. **Keyboard shortcut conflicts** in triage mode -- typing in any text field on the page will trigger A/D/R/S actions.
4. **Workflow builder config panel does not update** when different node types are selected -- always shows Approval Gate config.
5. **Hero prompts add vertical space** that pushes primary content further below the fold on shorter viewports.

---

## Per-Screen Analysis

---

### Shell: Topbar

**What was fixed from round 1:**

- T3 (Search jargon): Search placeholder simplified to "Search work items, runs, evidence..." (line 29). Fixed.

**Remaining issues:**

| ID   | Heuristic             | Severity | Issue                                                                                                                                                 | Location                       |
| ---- | --------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| T1v2 | H4: Consistency       | Minor    | Prototype controls (Persona/Workspace/State) are still mixed with production UI. No visual separation was added. Original T1.                         | `index.html` lines 38-66       |
| T2v2 | H8: Minimalist design | Minor    | Notifications button still uses text "Notifications" plus badge. Original T2.                                                                         | `index.html` lines 32-35       |
| T4v2 | H1: Visibility        | Major    | Mobile breakpoint still hides `topbar__center` entirely (`display: none`, `wireframe.css` line 1076). No search icon fallback was added. Original T4. | `wireframe.css` line 1075-1077 |

**New issues:**

| ID  | Heuristic       | Severity | Issue                                                                                                                                                                                                                                                                                                                | Location                     |
| --- | --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| T5  | H4: Consistency | Minor    | AB toggle buttons are injected into screen headers by JS (`wireframe.js` line 788), but are absent from Runs, Work Item Detail, Run Detail, Evidence, and Settings -- only present on Inbox, Work Items, Project Overview. The inconsistency may confuse users into thinking the toggle is missing on other screens. | `wireframe.js` lines 833-856 |

---

### Shell: Sidebar

**What was fixed from round 1:**

- S1 (Nav items styled as buttons): Nav items are now a flat list with `border: none`, transparent background, and left-border active highlight (`wireframe.css` lines 188-211). Fixed.
- S2 (No icons/badges): Icons added to every nav item (lines 76-106) and badge counts on Inbox (5), Work Items (7), Runs (1), Approvals (2), Agents (1). Fixed.
- S5 (Proximity/grouping): Navigation is now grouped under section titles (Workspace, Work, Configuration, Quick Actions, Support) with `border-top` separators (`wireframe.css` lines 244-258). Substantially improved.
- S6 (No collapsed mode): Not addressed, but lower priority.

**Remaining issues:**

| ID   | Heuristic             | Severity | Issue                                                                                                                                                                                 | Location                   |
| ---- | --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| S3v2 | H2: Match real world  | Minor    | Quick Actions section (lines 109-117) still mixes navigation ("Start workflow" linking to #work-items) with implied actions. "Start workflow" does not start a workflow. Original S3. | `index.html` lines 111-112 |
| S4v2 | H8: Minimalist design | Minor    | Persona hint box (lines 119-125) still present with dashed border. Original S4.                                                                                                       | `index.html` lines 119-125 |

**New issues:**

| ID  | Heuristic           | Severity | Issue                                                                                                                                                                                                                                                                                                                                                                    | Location                   |
| --- | ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| S7  | H6: Recognition     | Minor    | Nav icons use HTML entities (`!`, `#`, `&equiv;`, `&rsaquo;`, `&loz;`, `&check;`, `&sect;`, `&diams;`, `&bull;`) that are semantically opaque. For example, `&loz;` (lozenge) for Workflow Builder and `&sect;` (section sign) for Evidence do not visually represent their concepts. At the lo-fi stage this is acceptable, but production should use meaningful icons. | `index.html` lines 76-106  |
| S8  | H4: Consistency     | Minor    | The "Agents" nav item has a danger badge (`nav__badge--danger`, line 104) with count "1", but it is unclear what this count represents -- is it 1 agent in error, or 1 agent total? The other badges (Inbox 5, Work Items 7) represent actionable items. The Agents badge semantics are ambiguous.                                                                       | `index.html` line 104      |
| S9  | Gestalt: Similarity | Minor    | Quick actions links (lines 111-116) use `nav__item` class identical to main nav items, making them indistinguishable from primary navigation. Quick actions should be visually differentiated (e.g., smaller size, different icon style, or secondary text weight).                                                                                                      | `index.html` lines 111-116 |

---

### Shell: Drawer (Right Panel)

**What was fixed from round 1:**

- None of the drawer-specific issues were addressed in this round.

**Remaining issues:**

| ID   | Heuristic            | Severity | Issue                                                                                                                                                                                             | Location                                |
| ---- | -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| D1v2 | H6: Recognition      | Major    | The trigger button is still labeled "Context" with no icon (lines 165-167, 444, 923-925, 1099-1101, 1591-1593). Original D1.                                                                      | Multiple screen headers                 |
| D4v2 | H2: Match real world | Major    | The drawer title is still "Correlation Context" (`wireframe.js` line 38) and sections still use "SoR Ref Cluster" (`wireframe.js` lines 70, 133, 183, 224, 275). Original D4 + additional jargon. | `wireframe.js` DRAWER_CONTENT           |
| D5v2 | Cognitive load       | Major    | Drawer still duplicates information visible on the main screen (plan, effects, linked records). Original D5.                                                                                      | `wireframe.js` DRAWER_CONTENT templates |

**New issues:** None.

---

### Shell: Status Bar

**What was fixed from round 1:**

- SB2 was partially addressed: status bar now dynamically changes based on system state (`wireframe.js` lines 610-643), providing more meaningful status text during degraded/misconfigured states.

**Remaining issues:**

| ID    | Heuristic            | Severity | Issue                                                                                  | Location                      |
| ----- | -------------------- | -------- | -------------------------------------------------------------------------------------- | ----------------------------- |
| SB1v2 | H1: Visibility       | Minor    | Status bar is still easy to overlook (36px, small font, low contrast). Original SB1.   | `wireframe.css` lines 285-296 |
| SB2v2 | H9: Error recovery   | Major    | Status bar items are still not clickable. No link to diagnostic screens. Original SB2. | `index.html` lines 2621-2634  |
| SB3v2 | H2: Match real world | Minor    | Still uses "Chain: verified" instead of "Audit log: OK." Original SB3.                 | `wireframe.js` line 622       |

**New issues:** None.

---

### Screen: Inbox

**What was fixed from round 1:**

- I2 (Next-action not prominent): Hero prompt added at top with prominent CTA "Review failed run" (lines 171-177). The old next-action bar is still present below it (lines 188-198), creating redundancy (see new issues). Partially fixed.
- I3 (Filter meta-description): Filter chip now shows "Failures + blocks" (line 180) instead of "Default filters: failures + blocks." Minor improvement, but the chip text still changes dynamically via JS (line 461) using meta-descriptions like "Default filters: approvals assigned to me."
- I8 (No clear primary task): Hero prompt addresses this directly with plain language guidance. Fixed.
- I9 (Inconsistent action buttons): Not addressed.

**Remaining issues:**

| ID   | Heuristic              | Severity | Issue                                                                                                                                                                                                                                                                                                                                                                           | Location                                 |
| ---- | ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| I1v2 | H8: Minimalist design  | Major    | Inbox variant A still shows 3-4 card sections simultaneously in a 2-column grid (lines 213-356). Downgraded from Critical to Major because the hero prompt now provides a focal point, but the density below it is still high.                                                                                                                                                  | `index.html` lines 212-357               |
| I4v2 | H2: Match real world   | Minor    | "Pending Approval Gates" card title (line 215) was not renamed. Audit recommended "Awaiting your approval." Similarly, "Run Failures" (line 247) and "Policy Violations" (line 273) use passive noun phrases rather than action-oriented language.                                                                                                                              | `index.html` lines 215, 247, 273         |
| I5v2 | H2: Match real world   | Major    | Inbox rows still contain stacked domain badges: `SoD: maker-checker` (line 227), `retry-safe` (line 255). These were flagged in original I5 for removal from primary surfaces.                                                                                                                                                                                                  | `index.html` lines 227, 255              |
| I7v2 | Gestalt: Figure-ground | Minor    | Improved by removing grid-paper background, but cards still use uniform `2px solid var(--line)` borders and `var(--shadow)`. The `card--featured` class is applied dynamically by JS (line 538), but its visual differentiation from standard cards is subtle (only shadow depth changes, from `var(--shadow)` to `0 4px 0 rgba(27,27,27,0.22)` per `wireframe.css` line 1015). | `wireframe.css` lines 524-531, 1013-1017 |

**New issues:**

| ID  | Heuristic             | Severity | Issue                                                                                                                                                                                                                                                                                                                                                                                                                                           | Location                                                                                                                                                                                              |
| --- | --------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| I10 | H8: Minimalist design | Major    | The hero prompt (lines 171-177) AND the next-action bar (lines 188-198) both convey the same information about the failed run. The hero prompt says "A run failed and can be retried" with a "Review failed run" CTA, while the next-action bar says "Run R-8850 failed: CRM sync hit rate limit" with a "Retry run" CTA. This is redundant and adds vertical space. The next-action bar should be removed since the hero prompt supersedes it. | `index.html` lines 171-198                                                                                                                                                                            |
| I11 | H4: Consistency       | Minor    | The hero prompt CTA "Review failed run" links to `#run` (line 176), while the next-action "Retry run" also links to `#run` (line 197). Two different labels for the same navigation target.                                                                                                                                                                                                                                                     | `index.html` lines 176, 197                                                                                                                                                                           |
| I12 | H3: User control      | Minor    | The Inbox hero prompt text is not persona-adaptive. It always says "A run failed and can be retried" regardless of persona. The `js-hero-inbox-text` class (line 172) suggests JS should update it, but the JS only updates the next-action text (`js-next-action-text`, wireframe.js line 485), not the hero prompt. An approver sees "A run failed" as their hero guidance instead of "2 approvals await your decision."                      | `wireframe.js` -- hero prompt not updated in `setPersona()`                                                                                                                                           |
| I13 | H2: Match real world  | Minor    | Inbox variant B (Priority Matrix, lines 360-423) uses Eisenhower-matrix language ("Urgent + Important", "Urgent + Not Important", "Not Urgent + Important", "Not Urgent + Not Important"). This imposes a specific productivity framework that may not match users' mental model of their work queue.                                                                                                                                           | `index.html` lines 362-421                                                                                                                                                                            |
| I14 | H1: Visibility        | Minor    | The AB toggle for Inbox ("A                                                                                                                                                                                                                                                                                                                                                                                                                     | B" pill) is injected into `.screen__actions` (wireframe.js line 788) alongside the "Start workflow" and "Context" buttons, but has no label. Users must discover its purpose through experimentation. | `wireframe.js` line 749 |

---

### Screen: Project Overview

**What was fixed from round 1:**

- P3 (Jargon): "Execution Tier distribution (effective)" renamed to "Automation level distribution" (line 477). Fixed.
- P5 (Duplicate Quick Actions): Sidebar "Quick Actions" renamed contextually, and the Project Overview card renamed to "Common Workflows" (line 505). Partially fixed -- both still appear simultaneously.
- Hero prompt added (lines 450-456) answering "What should I do here?" with specific numbers and a CTA to Inbox. Fixed for P4 (task clarity).

**Remaining issues:**

| ID   | Heuristic             | Severity | Issue                                                                                                                                                                                                      | Location                                 |
| ---- | --------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| P1v2 | H1: Visibility        | Major    | Metrics still show numbers without trend or context. "7" has no sparkline or delta. Variant B (dashboard with sparklines, lines 535-615) addresses this, but variant A does not. The default variant is A. | `index.html` lines 460-473               |
| P2v2 | H8: Minimalist design | Minor    | Health and Risk bar chart (lines 475-503) is still always visible for all personas. Not persona-adaptive.                                                                                                  | `index.html` lines 475-503               |
| P6v2 | Gestalt: Proximity    | Minor    | Metric cards and content cards still use identical styling. Original P6.                                                                                                                                   | `wireframe.css` lines 599-615 vs 524-531 |

**New issues:**

| ID  | Heuristic             | Severity | Issue                                                                                                                                                                                                                                        | Location                                                                                                                                              |
| --- | --------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| P7  | H4: Consistency       | Minor    | Variant B (dashboard, lines 535-615) introduces sparklines and a risk heatmap that do not appear anywhere else in the prototype. These are visually sophisticated compared to the rest of the lo-fi wireframe, creating a fidelity mismatch. | `wireframe.css` lines 1342-1410                                                                                                                       |
| P8  | H6: Recognition       | Minor    | The risk heatmap cells (lines 593-613) use color intensity to encode severity, but the color encoding (green/amber/red) is not explained with a legend. Users must infer the color scale.                                                    | `index.html` lines 592-613                                                                                                                            |
| P9  | H8: Minimalist design | Minor    | Sparkline legend "Blue = failure                                                                                                                                                                                                             | Gray = success" (line 551) inverts the standard color convention where red/orange = danger and green/gray = normal. Blue for failure is non-standard. | `index.html` line 551 |

---

### Screen: Work Items

**What was fixed from round 1:**

- W1 (SoR Refs jargon): Column header renamed to "Linked Systems" (line 679). Fixed.
- W2 (Port Family jargon): Filter chip renamed to "Category: Payments & Billing" (line 650). Fixed.
- W3/W4 (Drift column, too many columns): Drift column removed. Table now has 7 columns (Title, Status, Tier, Owner, Linked Systems, Latest Run, Updated) instead of 8. Drift appears as an inline badge on Status column for WI-1105 (line 729). Fixed.
- Hero prompt added (lines 638-643). Fixed.

**Remaining issues:**

| ID   | Heuristic         | Severity | Issue                                                                                                                                                                                                  | Location                              |
| ---- | ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| W5v2 | H7: Flexibility   | Minor    | No sort controls on table headers. Original W5.                                                                                                                                                        | `index.html` lines 673-682            |
| W6v2 | Information scent | Minor    | Only the first table row has `js-drawer-trigger` (line 687). Other rows are plain links. Inconsistent clickability persists. Original W6, partially improved since all rows now consistently navigate. | `index.html` lines 685-737            |
| W7v2 | H4: Consistency   | Minor    | Port-icon abbreviations (FA, PB, DM, CS) are still unexplained. Original W7.                                                                                                                           | `index.html` lines 695-696, 707, etc. |

**New issues:**

| ID  | Heuristic             | Severity | Issue                                                                                                                                                                                                                                                                                                                                          | Location                   |
| --- | --------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| W8  | H2: Match real world  | Minor    | Kanban variant B (lines 745-806) is a good addition, but the column titles ("Open", "In Progress", "Blocked", "Done") diverge from the status labels in the table ("Needs approval", "In progress", "Open", "Completed"). "Blocked" in kanban vs "Needs approval" in table for the same work item (WI-1099) creates terminology inconsistency. | `index.html` lines 748-803 |
| W9  | H8: Minimalist design | Minor    | The Work Items empty state (lines 653-663) still uses jargon: "A Work Item binds ExternalObjectRefs, Runs, Approvals, and Evidence." This was not cleaned up. "ExternalObjectRefs" was renamed elsewhere but persists here.                                                                                                                    | `index.html` lines 656-657 |

---

### Screen: Runs

**What was fixed from round 1:**

- RN4 (No inline actions for failed runs): Not addressed. Failed rows still lack inline retry buttons.
- No hero prompt was added to the Runs screen (unlike Inbox, Work Items, Project Overview, Approvals).

**Remaining issues:**

| ID    | Heuristic       | Severity | Issue                                                                            | Location                              |
| ----- | --------------- | -------- | -------------------------------------------------------------------------------- | ------------------------------------- |
| RN1v2 | H4: Consistency | Minor    | CTA is still "Start workflow" linking to `#work-items` (line 819). Original RN1. | `index.html` line 819                 |
| RN2v2 | H1: Visibility  | Minor    | Approval column info still easy to miss. Original RN2.                           | `index.html` line 860                 |
| RN3v2 | H6: Recognition | Minor    | Run IDs still opaque. Original RN3.                                              | `index.html` lines 856, 865, 874, 883 |
| RN4v2 | Task clarity    | Minor    | Failed runs still lack inline actions. Original RN4.                             | `index.html` line 874                 |

**New issues:**

| ID  | Heuristic       | Severity | Issue                                                                                                                                                                                                                   | Location                   |
| --- | --------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| RN5 | H4: Consistency | Major    | Runs is the only list screen without a hero prompt. Inbox, Work Items, Project Overview, Approvals, Workflow Builder, and Agents all have hero prompts. The omission is conspicuous and breaks the established pattern. | `index.html` lines 812-894 |

---

### Screen: Work Item Detail

**What was fixed from round 1:**

- WD2 ("Attach ExternalObjectRef"): Renamed to "Link external record" (line 922). Fixed.
- WD3 (Tab count badges): Added -- "Runs (1)", "Approvals (1)", "Evidence (12)" (lines 953-955). Fixed.
- WD6 ("Portarium intends to..."): Still present in some locations (lines 972, 1043, 1124) but changed to "This workflow will..." in the triage card back (line 1422). Partially fixed.

**Remaining issues:**

| ID    | Heuristic             | Severity | Issue                                                                                                                                                                                                                                                                                  | Location                          |
| ----- | --------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| WD1v2 | H8: Minimalist design | Major    | Header still dense: title + tier badge + SoD badge + owner/status in one block (lines 910-918), plus policy callout (lines 929-932), linked records card (lines 935-948), tabs (lines 951-956), and effects card (lines 1038-1077). No progressive disclosure was added. Original WD1. | `index.html` lines 899-1077       |
| WD4v2 | H3: User control      | Minor    | Breadcrumbs still end with trailing "/" (line 908): "Project / Work Items /". The current page is not included. Original WD4.                                                                                                                                                          | `index.html` line 908             |
| WD5v2 | Gestalt: Proximity    | Minor    | Uniform 12px margins between unrelated sections persist. Original WD5.                                                                                                                                                                                                                 | `index.html` lines 935, 951, 1038 |
| WD7v2 | H1: Visibility        | Major    | Effects section is still below the tabs. When viewing Runs or Approvals tab, effects are invisible. Original WD7.                                                                                                                                                                      | `index.html` lines 1038-1077      |
| WD8v2 | IA                    | Major    | Screen still tries to be both summary hub AND detail view. Original WD8.                                                                                                                                                                                                               | `index.html` lines 899-1077       |

**New issues:**

| ID   | Heuristic            | Severity | Issue                                                                                                                                                                                              | Location                     |
| ---- | -------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| WD9  | H4: Consistency      | Minor    | No hero prompt on the Work Item Detail screen, unlike most other screens. Given it is a detail view this is defensible, but the Approvals screen (also a list/detail hybrid) has one.              | `index.html` lines 899-1078  |
| WD10 | H2: Match real world | Minor    | "SoD: maker-checker" badge remains in the header h1 (line 913). The original audit recommended moving this to a collapsible Policy section and using plain language "Requires different approver." | `index.html` line 913        |
| WD11 | H2: Match real world | Minor    | "Portarium intends to..." still used as the Planned Effects hint (line 1043) and in timeline entry (line 972). The original audit flagged this personification of software.                        | `index.html` lines 972, 1043 |

---

### Screen: Run Detail

**What was fixed from round 1:**

- RD2 (Decision form defaults to Approve): Fixed. Dropdown now defaults to "Select decision..." (line 1210). Fixed.
- RD3 (Outcome preview below submit): Fixed. Outcome preview is now above the form\_\_actions div (lines 1224-1227, then 1228). Fixed.

**Remaining issues:**

| ID    | Heuristic              | Severity | Issue                                                                                                                                                                                                                                                                                                                      | Location                                                                  |
| ----- | ---------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| RD1v2 | H8: Minimalist design  | Major    | Approval Gate card still contains 7 distinct content sections: policy evaluation callout (line 1187), SoD danger callout (line 1192), prior decisions (line 1197), decision form (lines 1206-1214), rationale textarea (lines 1216-1222), outcome preview (lines 1224-1227), form actions (lines 1228-1231). Original RD1. | `index.html` lines 1180-1233                                              |
| RD4v2 | H3: User control       | Minor    | "Retry" button outcome preview text (lines 1103-1105) is still outside the button's visual container and uses jargon: "Idempotency key ensures no duplicate side effects." Original RD4 + jargon.                                                                                                                          | `index.html` lines 1103-1105                                              |
| RD5v2 | Progressive disclosure | Major    | Verified Effects "Not available yet" section still shown with muted styling (lines 1160-1175, including a hidden drift badge at line 1168). The recommendation to hide unavailable sections was not implemented. Original RD5.                                                                                             | `index.html` lines 1160-1175                                              |
| RD6v2 | H2: Match real world   | Minor    | "Confidence: 0.82" still raw (line 1154). Original RD6.                                                                                                                                                                                                                                                                    | `index.html` line 1154                                                    |
| RD7v2 | Task clarity           | Major    | Approval form is still visible regardless of persona/role. Original RD7 -- no RBAC gating was added.                                                                                                                                                                                                                       | `wireframe.js` -- `setPersona()` does not hide the form for non-approvers |

**New issues:**

| ID  | Heuristic            | Severity | Issue                                                                                                                                                          | Location                     |
| --- | -------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| RD8 | H2: Match real world | Minor    | Breadcrumb trail (lines 1086-1088) reads "Work Items / WI-1099 / Runs /" -- still ends with trailing "/" and omits current page "R-8920." Same pattern as WD4. | `index.html` lines 1086-1088 |
| RD9 | H1: Visibility       | Minor    | The "Portarium intends to..." hint (line 1124) persists in the Plan + Effects card.                                                                            | `index.html` line 1124       |

---

### Screen: Approvals / Triage

**What was fixed from round 1:**

- A1 (Dual paths -- table AND focused review): The static "Focused Review" card was removed and replaced with a toggleable Triage view (lines 1349-1571). Users now have a clear table-or-triage choice. Fixed.
- A3 (No inline approval): The Triage view allows approve/deny/changes/skip directly from the Approvals screen without navigating to Run Detail. Fixed.
- Hero prompt added (lines 1285-1301) with clear guidance and toggle between table and triage views. Fixed.

**Remaining issues:**

| ID   | Heuristic             | Severity | Issue                                                                                                                                       | Location                      |
| ---- | --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| A2v2 | H8: Minimalist design | Minor    | "SoD" column still present in table (line 1317), empty for some rows, shows "maker-checker" for others. Original A2.                        | `index.html` lines 1317, 1328 |
| A4v2 | Task clarity          | Minor    | Subtitle still says "Queue and history" (line 1278) but only pending items are shown. No toggle between Pending/History views. Original A4. | `index.html` line 1278        |

**New issues:**

| ID  | Heuristic            | Severity | Issue                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Location                                                   |
| --- | -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| A6  | H5: Error prevention | Critical | **Bug:** When a user denies an approval and enters a rationale, the "Confirm decision" button (`triageRationaleSubmit`, wireframe.js line 1060) calls `triageAction('skip')` instead of `triageAction('deny')`. The code reads: `triageAction(action === 'deny' ? 'skip' : action)` (line 1065). This means a deliberate deny is silently converted to a skip. The condition appears inverted -- it should be `triageAction(action)` to pass through the actual pending action. | `wireframe.js` line 1065                                   |
| A7  | H5: Error prevention | Major    | **Keyboard shortcut conflict:** Triage keyboard shortcuts (A/D/R/S/Space) are active whenever the triage view is visible and the rationale panel is hidden (wireframe.js lines 1086-1101). However, if a user focuses any input/textarea elsewhere on the page (e.g., global search in topbar) and types "a", it will trigger approve. The handler does not check `e.target.tagName` or `document.activeElement`.                                                               | `wireframe.js` lines 1086-1101                             |
| A8  | H3: User control     | Major    | There is no way to undo or go back in triage mode. Once an approval is swiped, the card animates out and `triageIndex` increments (wireframe.js line 896). After 2 actions, `triageComplete` is shown (wireframe.js lines 897-903). If a user accidentally approves the wrong item, there is no undo. The summary screen (lines 1557-1571) shows stats but no option to review or reverse decisions.                                                                            | `wireframe.js` lines 894-903, `index.html` lines 1557-1571 |
| A9  | H4: Consistency      | Minor    | The triage card header shows "AG-442" as an ID (line 1365) and "Requires different approver" as a SoD badge (line 1367). In the table view, the same item shows "maker-checker" as the SoD label (line 1328). Inconsistent language for the same concept between table and triage views.                                                                                                                                                                                        | `index.html` lines 1328 vs 1367                            |
| A10 | H1: Visibility       | Minor    | The triage "next preview" card (lines 1477-1481) shows only the title of the next approval. If there are no more items, the preview should not be shown, but there is no JS logic to hide it when `triageIndex` approaches the total.                                                                                                                                                                                                                                           | `index.html` lines 1477-1481                               |
| A11 | H7: Flexibility      | Minor    | The triage view is hard-coded for exactly 2 items (`if (triageIndex >= 2)` at wireframe.js line 897). In production, the count would be dynamic, but the prototype does not allow testing with different queue sizes.                                                                                                                                                                                                                                                           | `wireframe.js` line 897                                    |
| A12 | H6: Recognition      | Minor    | Triage action buttons use Unicode symbols (checkmark, X, return arrow, down arrow) that may render inconsistently across browsers and platforms. The symbols at lines 1517, 1527, 1537, 1547 (`&#10005;`, `&#8634;`, `&#8628;`, `&#10003;`) are not part of a standard icon set.                                                                                                                                                                                                | `index.html` lines 1517, 1527, 1537, 1547                  |

---

### Screen: Evidence

**What was fixed from round 1:**

- No evidence-specific fixes were implemented. All original issues remain.

**Remaining issues:**

| ID   | Heuristic             | Severity | Issue                                                                                                                                                                     | Location                                              |
| ---- | --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| E1v2 | H2: Match real world  | Major    | Screen subtitle still says "Explore and verify hash-chained evidence entries" (line 1586). All audit/compliance jargon persists. Original E1.                             | `index.html` line 1586                                |
| E2v2 | H8: Minimalist design | Minor    | Every evidence entry still has a "Verified" badge (lines 1631, 1645, 1655, 1665, 1675). Original E2.                                                                      | `index.html` evidence list                            |
| E3v2 | H1: Visibility        | Minor    | Retention tags still small (10px, `wireframe.css` line 914). "Approaching expiry 30d" tag still easy to miss. Original E3.                                                | `index.html` line 1662, `wireframe.css` lines 908-918 |
| E4v2 | H6: Recognition       | Major    | "EvidenceEntry:" prefix still present on every evidence entry title (lines 1625, 1639, 1649, 1659, 1669). The recommendation to remove this prefix was not implemented.   | `index.html` lines 1625, 1639, 1649, 1659, 1669       |
| E5v2 | Information scent     | Minor    | Only 2 of 5 evidence entries are clickable (lines 1619-1646 have `js-drawer-trigger`, lines 1647-1676 are `row--static` without drawer triggers). Original E5, not fixed. | `index.html` lines 1647-1676                          |
| E6v2 | Gestalt: Continuity   | Minor    | No visual timeline connector between entries. Original E6.                                                                                                                | Evidence list section                                 |

**New issues:**

| ID  | Heuristic            | Severity | Issue                                                                                                                                                                                                                                               | Location                            |
| --- | -------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| E7  | H4: Consistency      | Minor    | No hero prompt on the Evidence screen. This is one of only 3 screens without one (alongside Runs and Settings). The inconsistency is conspicuous.                                                                                                   | `index.html` lines 1577-1703        |
| E8  | H2: Match real world | Minor    | "Linked Objects" card (line 1681) contains nested cards (lines 1684-1701) with "SoR: FinanceAccounting" (line 1686), "SoR: PaymentsBilling" (line 1691), "SoR: CustomerSupport" (line 1698). This "SoR:" prefix jargon was supposed to be replaced. | `index.html` lines 1686, 1691, 1698 |

---

### Screen: Settings

**What was fixed from round 1:**

- No Settings-specific fixes were implemented. All original issues remain.

**Remaining issues:**

| ID    | Heuristic             | Severity | Issue                                                                                                                                                  | Location                                    |
| ----- | --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| ST1v2 | H8: Minimalist design | Critical | Settings is still a single page with 4 dense cards plus inline capability matrix. No sub-navigation or collapsible sections. Original ST1.             | `index.html` lines 1708-1943                |
| ST2v2 | H5: Error prevention  | Major    | "Add user", "Add credential", "Rotate", "Select provider", "Register adapter", "Create rule" are all present with no confirmation flows. Original ST2. | Various button elements in settings section |
| ST3v2 | H2: Match real world  | Minor    | Subtitle still says "RBAC, credential vaulting, adapters/providers, and policies" (line 1717). Original ST3.                                           | `index.html` line 1717                      |
| ST4v2 | H8: Minimalist design | Major    | Capability Matrix (lines 1826-1883) is still shown inline. Original ST4.                                                                               | `index.html` lines 1826-1883                |
| ST5v2 | H6: Recognition       | Minor    | Tier badges in Policies list still unexplained. Original ST5.                                                                                          | `index.html` lines 1898, 1908, 1918, 1935   |
| ST6v2 | IA                    | Major    | Settings still mixes configuration and governance. Original ST6.                                                                                       | `index.html` lines 1721-1943                |

**New issues:**

| ID  | Heuristic       | Severity | Issue                                                                  | Location                     |
| --- | --------------- | -------- | ---------------------------------------------------------------------- | ---------------------------- |
| ST7 | H4: Consistency | Minor    | No hero prompt on Settings. This is one of only 3 screens without one. | `index.html` lines 1708-1944 |

---

### Screen: Workflow Builder (NEW)

**What works well:**

- Three-panel layout (palette|canvas|config) follows established patterns from n8n, Retool, Zapier.
- Node types are color-coded with distinct left borders and icons (`wireframe.css` lines 1832-1853).
- Branching with Yes/No labels and visual connectors (lines 2068-2071, 2074-2143).
- Config panel updates title on node click (wireframe.js lines 909-926).
- Canvas has zoom controls and dot-grid background.
- Hero prompt (line 1968) provides orientation.

**Issues:**

| ID  | Heuristic             | Severity | Issue                                                                                                                                                                                                                                                                                                                    | Location                                                   |
| --- | --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| WB1 | H1: Visibility        | Major    | The config panel always shows Approval Gate configuration fields (lines 2209-2252) regardless of which node is selected. Only the title and subtitle update (wireframe.js lines 918-924). Selecting "Fetch Invoice" should show adapter/read config, not approval gate config. This breaks the configuration affordance. | `wireframe.js` lines 909-926, `index.html` lines 2206-2257 |
| WB2 | H3: User control      | Minor    | Undo/Redo buttons (line 1961-1962) are present but not functional. No JS handles these actions. Users may expect them to work, leading to frustration. Inactive buttons should be styled as disabled.                                                                                                                    | `index.html` lines 1961-1962                               |
| WB3 | H8: Minimalist design | Minor    | The palette, canvas, and config panel are all visible simultaneously at all viewport sizes. On smaller screens, the 3-panel layout collapses to a single column (wireframe.css lines 1940-1956), but this stacks 200px palette + scrollable canvas + 280px config vertically, which is hard to navigate.                 | `wireframe.css` lines 1940-1956                            |
| WB4 | H5: Error prevention  | Minor    | The "Run workflow" button (line 1964) is a primary CTA that would execute the draft workflow. There is no confirmation or "save first" warning. Given that workflows can have real-world effects (adapter writes), this is potentially dangerous.                                                                        | `index.html` line 1964                                     |
| WB5 | H6: Recognition       | Minor    | Node types in the palette use Unicode symbols (lightning bolt `&#9889;`, umbrella `&#9730;`, diamond `&#9670;`, bell `&#128276;`, brain `&#129504;`) that render inconsistently across platforms. Some may appear as emoji on some systems and as text on others.                                                        | `index.html` lines 1980, 1987, 1994, 2001, 2008            |
| WB6 | Gestalt: Continuity   | Minor    | The vertical connectors between branching rows (lines 2076-2078, 2126-2128) are short (20px, wireframe.css line 1901) and not visually prominent. The relationship between the condition node and its branches is hard to trace.                                                                                         | `wireframe.css` lines 1892-1905                            |
| WB7 | H2: Match real world  | Minor    | The config panel shows "Separation of Duties" as a dropdown with options "Maker-checker", "None", "N-of-M" (lines 2228-2233). "N-of-M" is cryptic. "Any N of M reviewers" or "Multi-party" would be clearer.                                                                                                             | `index.html` lines 2228-2233                               |

---

### Screen: Agents (NEW)

**What works well:**

- Master-detail layout with clear list/detail split (320px list + detail, wireframe.css lines 1961-1971).
- Agent cards show key stats (runs, success rate, avg time) at a glance (lines 2296-2308).
- Provider badges with distinct colors for Claude/OpenAI/Custom (wireframe.css lines 2010-2021).
- Error state card with red border and error message (lines 2336-2363).
- Detail panel has health banner, tabs (Configuration/Usage/Integrations), and cross-references to workflows.
- Hero prompt provides orientation (lines 2275-2280).
- Responsive: mobile collapses to horizontal scroll list + detail (wireframe.css lines 2107-2127).

**Issues:**

| ID  | Heuristic             | Severity | Issue                                                                                                                                                                                                                                                                                                                                                                                                                           | Location                                |
| --- | --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| AG1 | H1: Visibility        | Major    | The agent detail panel (lines 2391-2598) only shows data for "Invoice Classifier." When other agent cards are clicked, only the title and health banner update (wireframe.js lines 931-960). The tabs, configuration form, usage metrics, and integrations remain static. An approver clicking "Policy Validator" (which has an Error status) would see the healthy Invoice Classifier's config, creating a dangerous mismatch. | `wireframe.js` lines 931-960            |
| AG2 | H5: Error prevention  | Major    | The "Deactivate" button (line 2399) has no confirmation dialog. The callout warning that "Deactivating this agent will pause 2 active workflows" (lines 2592-2594) is in the Integrations tab -- a user on the Configuration tab would not see it before clicking Deactivate.                                                                                                                                                   | `index.html` line 2399, lines 2592-2594 |
| AG3 | H4: Consistency       | Minor    | Agent detail tabs use the same `.tabs`/`.tab`/`.tabpane` classes as the Work Item Detail tabs. The scoped `bindTabs()` (wireframe.js line 669: `container.closest('.agent-detail')                                                                                                                                                                                                                                              |                                         | container.closest('.screen')`) correctly scopes them, but visually the two tab bars are indistinguishable. The Agent detail tabs are nested inside a larger panel, making them harder to notice. | `wireframe.js` line 669 |
| AG4 | H2: Match real world  | Minor    | The "Capabilities" section (lines 2454-2472) uses checkboxes like "Read external records", "Classify / categorize", "Write external records." The relationship between capabilities and permissions is unclear. If "Write external records" is unchecked, does that mean the agent cannot write, or that the permission is not granted?                                                                                         | `index.html` lines 2454-2472            |
| AG5 | H8: Minimalist design | Minor    | The agent detail panel packs Configuration form, Capabilities checkboxes, Permissions section, Prompt Template textarea, and Save/Discard actions all in the first tab (lines 2416-2498). This is a long scrolling form. Consider grouping into collapsible sections or sub-tabs.                                                                                                                                               | `index.html` lines 2416-2498            |

---

## Cross-Cutting Issues

### Navigation and Wayfinding

1. **Improved but incomplete:** The sidebar grouping (Workspace / Work / Configuration / Quick Actions / Support) addresses the flat hierarchy problem from round 1. However, the breadcrumb inconsistency persists -- detail screens have breadcrumbs ending with trailing "/" (lines 908, 1087), list screens have no breadcrumbs, and the current page name is never included.

2. **Back navigation is still ad-hoc:** Approvals has "Back to Inbox" (line 1281). Run Detail has "Back to Work Item" (line 1230). No consistent pattern. The breadcrumb should serve as back navigation but is incomplete.

3. **Drawer still competes with navigation:** `.js-drawer-trigger` elements on links (e.g., Work Items table row, line 687) both navigate AND open the drawer. The comment at wireframe.js line 1008 acknowledges this: "Don't prevent default for links -- let them navigate AND open drawer." This means clicking a row simultaneously changes the screen and slides in a drawer, which is disorienting.

### Language and Copy

1. **Primary surface jargon significantly reduced**, but **secondary surfaces still jargon-heavy:**
   - Drawer still titles itself "Correlation Context" (wireframe.js line 38)
   - Drawer sections still use "SoR Ref Cluster" (wireframe.js lines 70, 133, 183, 224, 275)
   - Evidence screen still uses "hash-chained evidence entries" (line 1586)
   - Status bar still uses "Chain: verified" (wireframe.js line 622)
   - Outcome preview on Run Detail still uses "Idempotency key" (line 1104)
   - Work Item Detail header still shows "SoD: maker-checker" badge (line 913)
   - Evidence entries still prefixed with "EvidenceEntry:" (lines 1625, 1639, 1649, 1659, 1669)
   - Evidence linked objects still use "SoR:" prefix (lines 1686, 1691, 1698)
   - Empty state for Work Items still uses "ExternalObjectRefs" (line 657)

2. **Naming inconsistency improved but not eliminated:**
   - "SoD: maker-checker" (table view, line 1328) vs "Requires different approver" (triage view, line 1367) -- same concept, two labels.
   - "Portarium intends to..." (lines 972, 1043, 1124) vs "This workflow will..." (line 1422) -- same intent, two phrasings.

3. **Hero prompts are a strong step toward action-oriented copy**, but card titles remain passive noun phrases: "Pending Approval Gates" (line 215), "Run Failures" (line 247), "Policy Violations" (line 273).

### Consistency Problems

1. **Badge variety unreduced:** The prototype still uses 7+ distinct badge types: `status` (pill), `tier-badge` (colored pill), `port-icon` (circle), `sod-badge` (pill), `idem-badge` (pill), `drift-badge` (pill), `retention-tag` (rectangle). Each has distinct border, color, and font size. CSS lines 575-968 define these -- no consolidation occurred.

2. **Hero prompt inconsistency:** Hero prompts appear on 6 of 11 screens (Inbox, Project Overview, Work Items, Approvals, Workflow Builder, Agents). Missing from Runs, Work Item Detail, Run Detail, Evidence, Settings. This partial adoption is worse than no adoption -- users come to expect the prompt and its absence feels like a gap.

3. **AB toggle inconsistency:** AB toggle appears on 3 screens (Inbox, Work Items, Project Overview) but not others. The toggle button has no explanatory label or tooltip.

---

## Gestalt Principles Re-Assessment

| Principle         | Round 1 State                                         | Round 2 State                                                                                                                                                            | Remaining Gap                                                                                                                                                                                                                    |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Proximity**     | Weak. All elements had uniform 12px gaps.             | Improved. Sidebar uses section titles with border separators to create visual groups. Card grids still use uniform gaps.                                                 | Work Item Detail and Run Detail still have uniform margins between unrelated content blocks.                                                                                                                                     |
| **Similarity**    | Weak. Cards/rows/badges/chips all shared same border. | Improved. Nav items are now flat (no borders), visually distinct from cards. `card--hero` and `card--subtle` classes exist.                                              | Visual hierarchy tiers are defined in CSS (lines 1109-1119) but underutilized in HTML. Most cards still use default `.card` styling. `card--hero` and `card--subtle` are not applied to any element in `index.html`.             |
| **Continuity**    | Missing. No connecting lines.                         | Improved. Workflow builder has connectors between nodes (wireframe.css lines 1873-1905) and branching with vertical lines (lines 1917-1926).                             | Evidence chain still lacks visual continuity. Step indicators on Run Detail still discrete pills without connecting lines.                                                                                                       |
| **Closure**       | Adequate.                                             | Adequate. Triage cards have clear boundaries. Workflow nodes are well-defined shapes.                                                                                    | No regression.                                                                                                                                                                                                                   |
| **Figure-Ground** | Weak. Grid-paper background competed with cards.      | Improved. Grid-paper background removed. Body now flat `var(--bg)`. Canvas dot-grid in Workflow Builder is appropriate (scoped to canvas area, wireframe.css line 1769). | Cards still use uniform `2px solid var(--line)` borders and `var(--shadow)`. The `card--featured` class provides slightly deeper shadow but no background differentiation. Needs stronger primary/secondary/subtle visual split. |

### Key Finding: Visual Hierarchy Tiers Defined but Not Applied

The CSS defines three visual tiers (wireframe.css lines 1109-1119):

```css
.card--subtle {
  border-style: dashed;
  box-shadow: none;
  background: rgba(255, 255, 255, 0.5);
}
.card--hero {
  padding: 16px;
  box-shadow: 0 4px 0 rgba(27, 27, 27, 0.22);
  border-width: 2px;
}
```

But searching the HTML, `.card--subtle` is **never used** and `.card--hero` is **never used**. The dynamic `.card--featured` (applied by JS to persona-primary inbox cards) uses the same shadow as `.card--hero` (wireframe.css line 1015) but is only applied via JavaScript card reordering in `setPersona()` (wireframe.js line 538). This means the visual hierarchy system was designed but not deployed across the prototype.

---

## Prioritized Action Items

### Critical (Must Fix)

1. **Fix triage rationale submit bug.** `wireframe.js` line 1065: `triageAction(action === 'deny' ? 'skip' : action)` should be `triageAction(action)`. Currently, deny decisions with rationale are silently converted to skips. This is a data integrity issue for a governance tool.

2. **Restructure Settings into sub-sections.** Replace the 4-card 2-column grid (`index.html` lines 1721-1943) with a vertical tabbed layout or left-side sub-navigation. Hide the Capability Matrix behind an expand control. Separate Configuration (RBAC, Credentials, Adapters) from Governance (Policies, Tiers). This is unchanged from round 1 and remains the densest screen.

### Major (Should Fix)

3. **Guard triage keyboard shortcuts against input field focus.** Add `if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;` at `wireframe.js` line 1089 (after the rationale check). This prevents A/D/R/S from triggering while the user is typing in search, rationale, or any form field.

4. **Add hero prompts to the 5 missing screens.** Runs, Work Item Detail, Run Detail, Evidence, Settings. Suggested text:
   - Runs: "You have 1 failed run and 1 paused run. Review the most urgent one."
   - Work Item Detail: "This work item is paused at an approval gate. Review the plan and decide."
   - Run Detail: "This run is waiting for your approval decision. Review the plan and effects below."
   - Evidence: "This is your tamper-proof audit log. Each entry is cryptographically linked to the previous one."
   - Settings: "Configure your workspace: manage users, credentials, integrations, and governance rules."

5. **Make hero prompt persona-adaptive.** The Inbox hero prompt (`js-hero-inbox-text`, line 172) should be updated by `setPersona()` in `wireframe.js` (alongside the next-action text at line 485-494). Each persona needs different hero text: Operator sees run failures, Approver sees pending approvals, Auditor sees evidence status, Admin sees configuration issues.

6. **Remove the redundant next-action bar from Inbox.** The hero prompt (lines 171-177) supersedes the next-action bar (lines 188-198). Removing the next-action bar reduces redundancy and reclaims vertical space. If the specific run ID detail is needed, incorporate it as a subtitle in the hero prompt.

7. **Replace remaining jargon on secondary surfaces.** Specific changes:
   - Drawer title "Correlation Context" -> "Related Items" (`wireframe.js` line 38)
   - Drawer section "SoR Ref Cluster" -> "Linked Records" (`wireframe.js` lines 70, 133, 183, 224, 275)
   - Evidence subtitle "hash-chained evidence entries" -> "tamper-proof audit log" (`index.html` line 1586)
   - "EvidenceEntry:" prefix -> remove from all titles (`index.html` lines 1625, 1639, 1649, 1659, 1669)
   - "SoR:" prefix in Linked Objects -> remove or replace with "Integration:" (`index.html` lines 1686, 1691, 1698)
   - Status bar "Chain: verified" -> "Audit log: OK" (`wireframe.js` line 622)
   - Outcome preview "Idempotency key ensures no duplicate side effects" -> "This retry is safe -- no duplicate actions will occur" (`index.html` line 1104)
   - Empty state "ExternalObjectRefs" -> "linked records" (`index.html` line 657)
   - "SoD: maker-checker" badge on Work Item Detail header -> "Requires different approver" or move to Policy callout (`index.html` line 913)

8. **Fix agent detail panel to update on card selection.** Currently only the title and health banner update when a different agent card is clicked (`wireframe.js` lines 931-960). The form fields, metrics, and integrations remain static. At minimum, swap the tab content for each agent, or display a message indicating the detail is a mock.

9. **Apply the visual hierarchy CSS classes.** `.card--hero` and `.card--subtle` were defined in CSS (lines 1109-1119) but never used in HTML. Apply `.card--hero` to the featured persona inbox card (currently only gets `card--featured` via JS), the triage card, and the primary effects card on Run Detail. Apply `.card--subtle` to metadata sections like the Linked External Records card, the Evidence card on Run Detail, and the capability matrix section.

10. **Make all evidence entries consistently interactive.** Give all 5 evidence rows `js-drawer-trigger` + `cursor: pointer` (currently only 2 of 5 have it). `index.html` lines 1647-1676 need `js-drawer-trigger` with appropriate `data-drawer` attributes.

### Minor (Nice to Fix)

11. **Add undo to triage mode.** After swiping a card, briefly show an "Undo" button (similar to Gmail's undo-send) before advancing to the next card. This prevents accidental approve/deny in a governance context.

12. **Fix breadcrumb trailing slashes.** Replace "Project / Work Items /" with "Project / Work Items / WI-1099" (`index.html` line 908). Replace "Work Items / WI-1099 / Runs /" with "Work Items / WI-1099 / Runs / R-8920" (`index.html` line 1087).

13. **Label the AB toggle.** Change the toggle button's `aria-label` and `title` from "Switch layout variant" to something like "Layout: A" (with visual text). Or add a small label "Layout" before the A|B pill. Current implementation has no visible label (`wireframe.js` line 749-750).

14. **Disable non-functional Undo/Redo buttons in Workflow Builder.** Add `disabled` attribute to the Undo and Redo buttons (`index.html` lines 1961-1962) and visually style them as inactive until the functionality is implemented.

15. **Rename Inbox card titles to action-oriented language.** "Pending Approval Gates" -> "Approve these items" or "Awaiting your approval." "Run Failures" -> "Fix these failures." "Policy Violations" -> "Resolve these policy issues."

16. **Consolidate "Portarium intends to..." wording.** Replace all instances with "This workflow will..." for consistency. Locations: `index.html` lines 972, 1043, 1124.

17. **Add a tier badge legend.** On any screen where tier badges appear (Work Items, Project Overview, Settings Policies), add a subtle legend or tooltip explaining Auto / Assisted / Human-approve / Manual-only. A single shared footer note or hover tooltip would suffice.

18. **Hide "Verified Effects: Not available yet" sections.** Instead of showing muted placeholders (`index.html` lines 1063-1075, 1160-1175), collapse them entirely. Show a note "Verified effects will appear after the run completes" as a single line, not a full effects card section.

19. **Use consistent status labels between table and kanban views.** The Work Items kanban uses "Blocked" for WI-1099, while the table shows "Needs approval." Align to one term (recommended: "Needs approval" since it is more specific).

20. **Make metric cards clickable on Project Overview.** Clicking "7" for Work Items should navigate to filtered Work Items list. Clicking "4" for Pending approvals should navigate to Approvals.

---

## Summary

The round 1 redesign successfully addressed the most critical structural issue -- the absence of orientation and task guidance -- through hero prompts. The sidebar navigation overhaul, approval form safety fix, and jargon cleanup on primary surfaces were well-executed. The new Triage, Workflow Builder, and Agent screens demonstrate thoughtful UX patterns (card stacking, 3-panel builder, master-detail).

However, the redesign was incomplete in three areas:

1. **Uneven application.** Hero prompts, jargon fixes, and visual hierarchy classes were applied selectively, leaving 5 screens without prompts, multiple secondary surfaces with jargon, and visual hierarchy CSS that is defined but never used. Partial adoption creates its own inconsistency.

2. **Untouched screens.** Evidence and Settings received zero changes. These were flagged as Critical/Major in round 1 and remain the weakest screens.

3. **New bugs in new features.** The triage rationale submit bug (A6) is a Critical data integrity issue. The keyboard shortcut conflict (A7) is a Major usability flaw. Both should be fixed before user testing.

The recommended approach for round 3 is: **fix the critical bug first**, then **complete the partial rollouts** (hero prompts, jargon, visual hierarchy) across all screens, and finally **restructure Evidence and Settings.**
