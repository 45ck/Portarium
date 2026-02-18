# UX Design: Governance and Policy Deep-Dive Screens

**Bead:** bead-0472
**Status:** Done
**Date:** 2026-02-18

---

## 1. Overview

The Governance screen gives compliance officers and platform admins full control over policy rules, SoD constraints, blast-radius visibility, and tenant isolation boundaries. It is the authoritative surface for configuring behavioural guardrails across the workspace.

---

## 2. Policy Rule List

A filterable, sortable table of all policy rules in the workspace.

### Columns

| Column            | Description                                                    |
| ----------------- | -------------------------------------------------------------- |
| Rule ID           | Shortened ID with copy button                                  |
| Name              | Human-readable rule name                                       |
| Trigger condition | Condensed expression (truncated at 60 chars, tooltip for full) |
| Tier              | Badge: Tier 1 / Tier 2 / Tier 3                                |
| Enabled           | Toggle switch                                                  |
| Actions           | Edit / Duplicate / Delete                                      |

### Tier Badge Colours

| Tier                | Background  | Border      |
| ------------------- | ----------- | ----------- |
| Tier 1 (advisory)   | neutral-100 | neutral-400 |
| Tier 2 (blocking)   | warning-100 | warning-500 |
| Tier 3 (hard-block) | error-100   | error-600   |

### Row Actions

- Edit: opens the rule editor slide-over.
- Duplicate: creates a new draft rule pre-populated from the selected rule.
- Delete: confirmation dialog showing rule name and affected-workflows count.
- Simulate: opens simulation mode for that specific rule.

---

## 3. Rule Editor

A slide-over panel (60% viewport width on desktop, full-width on mobile) containing a structured form.

### Sections

**1. Basic information** - Name (text input), Description (textarea), Tags (multi-select with create-new option)

**2. Trigger Condition Builder** - A visual condition builder with: Subject selector (dropdown: Run / Step / User / Resource), Attribute selector (context-sensitive), Operator selector (equals / not-equals / contains / greater-than / etc.), Value input. Multiple conditions combined with AND / OR logic. A Raw expression toggle switches to a plain-text expression editor for advanced users.

**3. Action Selector** - Action type (dropdown): Block / Warn / Require approval / Log only / Notify. Action-specific configuration: Require approval has approval tier picker and approver role selector; Notify has notification channel selector and message template.

**4. Tier Picker** - Radio buttons: Tier 1 (Advisory) / Tier 2 (Blocking) / Tier 3 (Hard-block). Each option includes a one-line description of the tier enforcement behaviour.

**5. Blast Radius Preview** - Rendered inline at the bottom of the editor.

Actions: [Save draft] [Save and enable] [Cancel]

---

## 4. Blast Radius Visualization

When the user finishes defining a trigger condition, the blast radius section renders automatically (debounced 500 ms after last change). Shows affected workflows, users, adapters, and record count as chip groups. Chips link to the filtered list of affected items. Record count is an estimate (shown with ~ prefix). If blast radius is zero: This rule currently matches no records.

If blast radius is very large (> 10,000 records): an amber warning: This rule will affect a large number of records. Review before enabling.

---

## 5. Tenant Isolation Display

A dedicated Isolation tab within the Governance screen shows:

### Workspace Boundary Card

Workspace: acme-corp
Isolation mode: strict
Cross-tenant data access: Disabled
Data residency: EU (Frankfurt)
Encryption scope: per-workspace

### Cross-Tenant Restriction Indicators

A table of configured inter-workspace relationships. Each row shows a direction arrow and the restriction level as a badge. Block all rules are shown in red.

---

## 6. SoD Constraint Editor

A matrix editor for Separation of Duties constraints. Rows = action types. Columns = roles. Cells contain a dropdown: Allowed, Requires different user, Prohibited.

                        Owner   Admin   Operator  Viewer

Initiate workflow ✓ ✓ ✓ ✗
Approve own workflow ✓ ≠ user ≠ user ✗
Revoke credentials ✓ ✓ ✗ ✗
Modify policy ✓ ≠ user ✗ ✗

Cells showing not-equal-user show a tooltip: This action must be performed by a different user than the one who initiated the workflow.

---

## 7. Screen States

### No Rules (Empty State)

No policy rules yet. Create your first rule to start enforcing governance policies. [Add first rule]

### Rule Conflict Warning

When two enabled rules have overlapping trigger conditions with conflicting actions, a warning badge appears on both rows: Conflict: This rule conflicts with invoice-block-rule. [View conflict]. Clicking View conflict opens a comparison slide-over showing both rules side-by-side with the conflicting conditions highlighted.

### Simulation Mode

Activated from a row action Simulate or from the global Simulation mode toggle in the page header. A banner appears: Simulation mode active. No policy changes will take effect. The rule editor Save and enable button becomes Apply simulation. After applying, a results panel shows: how many recent runs would have been blocked / warned / approved if this rule had been active.

---

## 8. Nielsen Heuristic Review

| Heuristic                                      | Application                                                                                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **#1 Visibility of system status**             | Blast radius preview updates live as conditions are edited; rule conflict badge makes problematic combinations immediately visible.    |
| **#5 Error prevention**                        | Simulation mode lets admins test policy changes safely before enabling; delete confirmation shows affected workflow count.             |
| **#3 User control and freedom**                | Enabled toggle allows quick disable without deleting a rule; Save draft allows partial work without enabling.                          |
| **#6 Recognition over recall**                 | Visual condition builder avoids requiring users to remember expression syntax; tier descriptions on radio buttons explain enforcement. |
| **#9 Help users recognise, diagnose, recover** | Conflict comparison slide-over shows exactly which conditions conflict; blast radius warning links to affected items.                  |

---

## 9. Accessibility (WCAG 2.2 AA)

- Policy rule table: role=table with proper semantic column headers and aria-sort on sortable columns.
- Enabled toggle: button role=switch with aria-checked and aria-label including rule name.
- Tier badge: aria-label=Tier 3: Hard-block.
- Conflict warning badge: role=alert so the conflict is announced when detected.
- SoD matrix: role=table; each dropdown cell has aria-label combining row action and column role.
- Blast radius chips: each chip is a link with descriptive aria-label.
- Simulation mode banner: role=status.
- Rule editor slide-over: focus trapped; Escape closes; focus returns to the triggering row action button.
