# Accessibility Known Issues (WCAG 2.1 AA)

Tracked pre-existing accessibility violations discovered during the initial
automated axe-core audit (bead-0945). These rules are excluded from the
automated test gate so they don't block CI while remediation is in progress.

## Excluded Rules

### `color-contrast` (WCAG 2.1 AA SC 1.4.3)

**Impact:** Serious

Some sidebar navigation items and muted-text elements have insufficient
contrast ratios against their background. This applies to the dark-themed
sidebar and some secondary text in card components.

**Remediation:** Adjust CSS custom properties for sidebar and muted text
colours to meet the 4.5:1 minimum contrast ratio for normal text.

**Status:** Open

### `button-name` (WCAG 2.1 A SC 4.1.2)

**Impact:** Critical

Multiple Radix UI `<Select>` combobox trigger buttons render without
discernible text (no `aria-label`, no visible text, no title). This affects
filter/sort dropdowns on the dashboard, approvals, runs list, and run
detail pages. Additionally, inline sort-toggle buttons in the runs table
lack accessible names.

**Affected pages:** Dashboard, Approvals, Runs list, Run detail

**Remediation:** Add `aria-label` props to all Radix `Select.Trigger`
components (e.g. `aria-label="Filter by status"`). Add accessible names
to inline sort buttons.

**Status:** Open

### `nested-interactive` (WCAG 2.1 A SC 4.1.2)

**Impact:** Serious

Table rows in the runs list use `cursor-pointer` and contain nested
interactive elements (links, buttons). Screen readers may not announce
nested controls correctly, and keyboard focus order can be confusing.

**Affected pages:** Runs list

**Remediation:** Either make the row non-interactive (remove click
handler, use links within cells) or flatten the interactive hierarchy
so the row itself is not implicitly interactive.

**Status:** Open

### `aria-valid-attr-value` (WCAG 2.1 A SC 4.1.2)

**Impact:** Critical

On the approvals page, Radix UI `<Tabs>` trigger buttons reference content
panel IDs via `aria-controls` that don't exist in the DOM (the content
panels are conditionally rendered). This causes axe to flag the
`aria-controls` value as invalid.

**Affected pages:** Approvals (triage mode tabs)

**Remediation:** Ensure Radix `Tabs.Content` panels are always rendered in
the DOM (use CSS to hide inactive panels) or remove `aria-controls` from
triggers when the referenced panel is not mounted.

**Status:** Open

---

## How This Works

The automated a11y test suite (`e2e/a11y/wcag-aa.spec.ts`) runs axe-core
with WCAG 2.1 AA tags on every critical page. Rules listed above are
disabled via `disableRules()` so pre-existing issues don't fail CI.

As each issue is remediated, remove it from the `KNOWN_ISSUE_RULES` array
in the test file so regressions are immediately caught.

## Adding New Known Issues

If a new component introduces a temporary a11y violation:

1. Add the axe rule ID to `KNOWN_ISSUE_RULES` in `e2e/a11y/wcag-aa.spec.ts`
2. Document the issue in this file with impact, description, and remediation plan
3. Create a bead to track the fix
