# Cockpit Prototype UX Fixes Plan

> **Priority:** High
> **Bead:** bead-0293
> **Status:** Open
> **Date:** 2026-02-17
> **Scope:** `docs/internal/ui/cockpit/` — `index.html`, `wireframe.css`, `wireframe.js`

## Context

The cockpit prototype renders all 20 domain primitives but a critical UX
evaluation revealed that it does not match how real users think.
The fundamental problems are:

1. Persona switching is cosmetic, not structural.
2. The Inbox has poor visual hierarchy.
3. The drawer overlays critical content.
4. Screens lack forward-looking guidance after actions.
5. The Settings screen is a dead end for admins.

This plan addresses the highest-impact UX fundamentals to make the prototype
feel like a real tool that adapts to how each persona thinks.

---

## Fix 1 — Persona switching that actually changes layout (JS + HTML)

**Problem:** Switching persona changes 6 text labels but the screen content,
card order, and visual weight are identical.

**Fix — Inbox restructures per persona via JS card reordering + show/hide:**

| Persona  | Primary card (full-width) | Secondary cards                     | Hidden                     |
| -------- | ------------------------- | ----------------------------------- | -------------------------- |
| Operator | Run Failures              | Approval Gates, Policy Violations   | Quick Search               |
| Approver | Pending Approval Gates    | Policy Violations                   | Run Failures, Quick Search |
| Auditor  | New "Recent Evidence"     | Chain integrity status              | Run Failures, Quick Search |
| Admin    | New "Workspace Health"    | Policy Violations, missing adapters | Run Failures               |

**Implementation:**

- Add `data-inbox-section` attributes to each Inbox card.
- Add two new cards: "Recent Evidence" (auditor) and "Workspace Health" (admin).
- `setPersona()`: reorder via CSS `order`, toggle `card--featured` class, show/hide.

## Fix 2 — Kill the Quick Search card on Inbox (HTML)

**Problem:** Quick Search duplicates the topbar search bar, wasting 25% of
Inbox real estate.

**Fix:** Remove the Quick Search card entirely.

## Fix 3 — Drawer pushes content instead of overlaying (CSS)

**Problem:** The drawer at 360 px overlays the right column of 2-column
layouts. On Run Detail the Approval Gate panel is hidden behind the drawer.

**Fix:**

- Class `app--drawer-open` on `.app`.
- Grid changes to `grid-template-columns: var(--sidebar-width) 1fr var(--drawer-width)`.
- Drawer becomes a grid column; main content shifts.
- On mobile (< 980 px): keep overlay behavior.

## Fix 4 — Forward-looking guidance after decisions (HTML + JS)

**Problem:** After "Submit decision" on Approval Gate, the user has no idea
what happens next.

**Fix — `.outcome-preview` sections:**

- **Approval Gate:** "After approval: Run will resume automatically.
  1 more approver needed (SoD: maker-checker)."
- **Retry:** "Retry will re-queue the Run.
  Idempotency key ensures no duplicate side effects."
- **Approvals table:** "After deciding, the queue advances to the next
  pending gate."

## Fix 5 — Make Settings actionable (HTML)

**Problem:** Settings is read-only — an admin has no CTA.

**Fix — Stub action buttons:**

- RBAC: "Add user"
- Credentials: "Rotate", "Add credential"
- Adapters: "Select provider", "Register adapter"
- Policies: "Create rule"

## Fix 6 — Policy Violations card — add actionable CTA (HTML)

**Problem:** The SoD constraint row says "Assign an approver or update policy"
but has no button.

**Fix:** Add "Assign approver" (`#work-item`) and "Edit policy" (`#settings`)
buttons.

## Fix 7 — Stronger visual hierarchy (CSS)

**Problem:** Everything is `font-weight: 900`. Primary buttons are visually
indistinguishable from secondary buttons.

**Fix:**

- `row__title`: 700
- `drawer-section__title`: 700
- `btn--primary`: `background: var(--ink); color: #fff`
- New `.card--featured`: larger padding, stronger shadow, full-column span.

## Fix 8 — Status bar shows danger state (JS + CSS)

**Problem:** Status bar only toggles events to amber on degraded. Runs and
Chain indicators never change.

**Fix:**

- `misconfigured`: Runs dot amber, text "Runs: config warning".
- `policy-blocked`: Chain dot amber, text "Chain: policy hold".

---

## Verification checklist

1. Switch persona through all 4 values — each has a different primary card.
2. Drawer on Run Detail pushes content (Approval Gate panel stays visible).
3. Settings has stub action buttons.
4. Policy Violations card has "Assign approver" and "Edit policy" buttons.
5. Primary buttons are visually distinct.
6. Status bar responds to all system states.
7. Quick Search card is gone from Inbox.
