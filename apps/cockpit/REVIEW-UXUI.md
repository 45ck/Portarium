# Portarium Cockpit — UX/UI Design Review

**Reviewer:** UX/UI Design Agent
**Date:** 2026-02-20
**Scope:** Full cockpit front-end — routes, components, navigation, typography, and interaction design
**Platform context:** Enterprise operations cockpit for pharmaceutical cold-chain logistics — managing workflows, approvals, robots, and compliance

---

## Executive Summary

The cockpit is a well-structured enterprise operations platform with a clear architectural separation of concerns. The navigation is logically organized, the approval triage flow is genuinely innovative, and the design system is coherent and maintainable. However, the application has several significant usability gaps that would impede new users and reduce operational efficiency for experienced ones. The most critical issues are: no landing page or default route, loss of context on the approval triage card when it lacks a progress back-navigation, hardcoded mock data appearing in production UI, and the Dashboard failing to prioritize actionable items.

Severity scale: **Critical** — blocks task completion or creates compliance risk | **Major** — significant friction, workaround required | **Minor** — polish or preference issue

---

## 1. Information Architecture and Navigation Structure

### 1.1 — Major: No default landing route

**Location:** `__root.tsx`, router configuration
**Description:** There is no root `/` redirect. Users who navigate to the root URL will likely see a blank screen or a 404, because the root route renders an `<Outlet />` with no content of its own. The first meaningful page is `/inbox` or `/dashboard`, but neither is set as the default.
**Recommendation:** Add a redirect from `/` to `/inbox` (the primary triage surface). This makes it immediately clear where operational work begins.

### 1.2 — Minor: Navigation section label collision — "Work" and "Workspace"

**Location:** `__root.tsx` lines 23–56
**Description:** The sidebar has two adjacent sections named "Workspace" (containing Inbox, Dashboard, Work Items) and "Work" (containing Runs, Workflows, Approvals, Evidence). The near-identical labels are semantically confusing. "Work Items" under "Workspace" and "Approvals" under "Work" are both task-related and their grouping is not intuitive.
**Recommendation:** Rename "Workspace" to "My Triage" or "Operations Focus" and "Work" to "Records" or "Activity". Alternatively, flatten the hierarchy: move Inbox and Dashboard into a top-level "Home" group, then group domain objects by their relationship (Execution: Runs, Workflows; Decisions: Approvals, Work Items; Audit: Evidence).

### 1.3 — Minor: Sidebar collapse loses section labels but not useful context

**Location:** `__root.tsx` lines 178–220
**Description:** When the sidebar is collapsed (`sidebarCollapsed = true`), section labels (e.g., "Work", "Config", "Robotics") disappear. The icon-only mode is functional but tooltips are not rendered for collapsed nav items, making icon-only navigation depend on prior learning.
**Recommendation:** Add `<Tooltip>` wrapping to each `NavLink` when collapsed, showing the label on hover. This is a standard enterprise sidebar pattern.

### 1.4 — Minor: "Gateways" and "Workflows" navigation items likely lead to empty/unimplemented routes

**Location:** `__root.tsx` lines 38–51, 129–133
**Description:** Workflows (`/workflows`) and Gateways (`/robotics/gateways`) are listed in the nav but there are no corresponding route files in the codebase. Clicking these will produce an error or blank screen.
**Recommendation:** Either implement these routes or mark them visually as "Coming soon" (the `comingSoon` pattern already exists in `NavSectionDef` but is not used for these items). Using the existing pattern keeps UX consistent and prevents user confusion.

---

## 2. Visual Hierarchy

### 2.1 — Major: Dashboard uses a generic workflow icon for its page header

**Location:** `dashboard.tsx` line 122
**Description:** `<EntityIcon entityType="workflow" size="md" decorative />` is used as the dashboard icon. A workflow icon signals "this is about workflow records" rather than "this is your operational overview". The icon creates a false mental model.
**Recommendation:** Use `<LayoutDashboard>` from lucide-react (already imported in `__root.tsx`) as the dashboard page icon.

### 2.2 — Minor: "New Run" button on Dashboard is prominent but context-free

**Location:** `dashboard.tsx` line 124–125
**Description:** A "New Run" `<Button size="sm">` is rendered in the `PageHeader` action slot. This is the only primary CTA on the dashboard but it's unclear what workflow it creates, where it navigates, or what permission is required. There is no handler attached.
**Recommendation:** Either wire this button to a modal/drawer that prompts for workflow selection, or remove it until it is functional. A non-functional prominent CTA erodes trust.

### 2.3 — Minor: KpiRow trend indicators are supported in the component but never used

**Location:** `kpi-row.tsx` lines 5–9, `dashboard.tsx` lines 129–136
**Description:** `KpiStat` has `trend` and `trendValue` fields (`TrendingUp`, `TrendingDown`, `Minus` icons are implemented) but zero pages supply these values. The KPI cards render as static numbers with no comparative context.
**Recommendation:** Populate trend data where meaningful. At minimum, "Pending Approvals" trending up vs. prior period is a critical signal in a compliance-heavy environment.

---

## 3. Approval Triage Flow

### 3.1 — Critical: Rationale field is present but no validation feedback for Deny

**Location:** `approval-triage-card.tsx` lines 676–723
**Description:** The "Deny" button is disabled when `rationale.trim()` is empty (correct behavior), but there is no visible instruction or error state communicating _why_ the Deny button is disabled. The helper text "Rationale is optional when approving, required when denying" (line 675–677) exists but is in `text-[10px] text-muted-foreground` — easily missed. A first-time user who clicks Deny and sees nothing happen will be confused.
**Recommendation:** Elevate the rationale requirement for Deny with a more visible label (at minimum `text-xs` not `text-[10px]`). Add a yellow border or inline message to the textarea when a deny attempt is made without a rationale.

### 3.2 — Major: Triage card progress indicator doesn't communicate "you are done for now"

**Location:** `approvals/index.tsx` lines 147–163
**Description:** When `triageQueue.length === 0`, the `EmptyState` ("All caught up") is shown, but if the user skipped items, they are silently dropped from the session. The skip mechanism (`triageSkipped`) is session-only and there is no "review skipped items" affordance.
**Recommendation:** When the queue is exhausted but skipped items exist, show a distinct state: "You've reviewed X items. Y were skipped — review them?" with a button to reset `triageSkipped`. This closes the loop on triage sessions.

### 3.3 — Minor: Keyboard shortcuts are not surfaced until after the card is visible

**Location:** `approval-triage-card.tsx` lines 730–748
**Description:** The keyboard hints (A/D/R/S) are shown at the bottom of the triage card. This is good — but only appears to experienced users who scroll down on taller screens. Users should encounter the affordance before needing it.
**Recommendation:** Move the keyboard shortcut row above the action button row, directly visible without scrolling. Alternatively, show a first-time hint banner that dismisses after first use.

### 3.4 — Major: SoD evaluation and policy rule data are hardcoded mocks keyed on approval ID

**Location:** `approval-triage-card.tsx` lines 36–101
**Description:** `getSodEvaluation()` and `getPolicyRule()` contain hardcoded `if (approval.approvalId === 'apr-3002')` branches. In any real deployment, these would return wrong data for every approval that isn't one of two specific demo IDs. This is a compliance risk — the SoD banner is the primary safety signal for the approver.
**Recommendation:** Expose SoD evaluation and policy rule as fields on `ApprovalSummary` from the API layer. This is not a minor cosmetic issue — incorrect SoD display could lead to an approver self-approving a request, which is the exact violation SoD is designed to prevent.

### 3.5 — Minor: Swipe/card metaphor is not explained anywhere in the UI

**Location:** `approvals/index.tsx`, triage tab
**Description:** The triage tab uses a card swipe metaphor with slide animations and stacked ghost cards. This is a familiar pattern from consumer apps (Tinder-style) but in an enterprise compliance context, users may not understand that the animation represents a physical metaphor. The keyboard shortcut labels help, but the "stacked cards" visual has no tooltip or instruction.
**Recommendation:** Add a one-line subtitle to the triage tab content area: "Review one at a time — Approve or Deny each to progress through the queue."

---

## 4. Empty States

### 4.1 — Minor: EmptyState is generic and action-less by default

**Location:** `empty-state.tsx`, `data-table.tsx` line 115
**Description:** `DataTable` renders `<EmptyState title="No data" description="No items to display." />` as its default empty state. This is purely informational and provides no next step. In an ops platform, "no data" almost always has a reason (filter applied, no records yet, permission issue).
**Recommendation:** Pages using `DataTable` should pass a custom `empty` prop with context-specific messages and (where appropriate) a CTA. Example: Work Items empty state should offer "Create a Work Item" or "Clear filters". Runs empty state should link to Workflows.

### 4.2 — Minor: Evidence empty state lacks context about what "no evidence entries" means

**Location:** `evidence/index.tsx` line 65–67
**Description:** `<EmptyState title="No evidence" description="No evidence entries match your filters." />` is shown when filters yield nothing. This is acceptable for filtered views but if the full unfiltered dataset is empty (new workspace), users won't understand what evidence is or how it gets created.
**Recommendation:** Add a conditional: if no filter is applied and `items.length === 0`, show an onboarding-style message explaining that evidence is automatically generated as runs and approvals execute.

---

## 5. Loading and Error States

### 5.1 — Minor: Observability page has no error state

**Location:** `explore/observability.tsx` lines 61–117
**Description:** The observability page handles `isLoading` and `data`, but if the fetch fails (`isError`), the page silently renders nothing (the `else null` branch). A network error or 500 returns a blank white area.
**Recommendation:** Add an error branch:

```tsx
} else if (isError) {
  return <p className="text-sm text-destructive">Failed to load observability data.</p>;
}
```

### 5.2 — Minor: Governance page "Loading..." text is primitive

**Location:** `explore/governance.tsx` lines 109–111
**Description:** `<div className="text-xs text-muted-foreground">Loading...</div>` is used for loading state instead of the `<Skeleton>` component used elsewhere. This is inconsistent and visually jarring.
**Recommendation:** Replace with `<Skeleton className="h-4 w-1/2" />` to match the loading pattern used throughout the rest of the app.

### 5.3 — Major: Run detail page renders blank if `run` is null after loading (not `isError`)

**Location:** `runs/$runId.tsx` lines 87–94
**Description:** The guard `if (runLoading || !run)` shows a skeleton, but after loading completes, if `run` is `null` or `undefined` (e.g., a 404 from the API), the page returns the skeleton indefinitely. There is no `isError` check and no user-facing message like the one in `approvals/$approvalId.tsx`.
**Recommendation:** Add `isError` handling, mirroring the Approval detail page pattern (lines 50–65 of `$approvalId.tsx`).

---

## 6. Data Density vs. Whitespace

### 6.1 — Minor: Runs and Work Items list pages lack summary KPIs

**Location:** `runs/index.tsx`, `work-items/index.tsx`
**Description:** The Dashboard shows KPI stats for active runs and SLA-at-risk items. The dedicated Runs and Work Items pages do not show any aggregate counts or status summaries above their data tables. Users navigating directly to these pages lose the operational summary context.
**Recommendation:** Add a compact `KpiRow` at the top of the Runs page (Active, Pending, Failed counts) and Work Items page (Open, At Risk, Overdue SLA). This is consistent with the pattern used on Dashboard, Inbox, Observability, and Governance.

### 6.2 — Minor: Safety page uses `space-y-8` creating excessive vertical gaps

**Location:** `robotics/safety.tsx` line 47
**Description:** The Safety page uses `space-y-8` between sections, while all other pages use `space-y-6` or `space-y-4`. This creates a noticeably looser layout that breaks visual rhythm when switching between sections.
**Recommendation:** Normalize to `space-y-6` to match the platform baseline.

### 6.3 — Minor: Robot cards show "Test ↺" button with no implementation

**Location:** `robotics/robots.tsx` line 75
**Description:** Each robot card has a "Test ↺" button with no click handler (`onClick` is missing). Buttons that do nothing are worse than no buttons — they create expectation without fulfillment.
**Recommendation:** Either implement the test ping/diagnostic action or remove the button until it is ready.

---

## 7. Consistency of Patterns

### 7.1 — Minor: Robotics pages use inline stat cards instead of KpiRow

**Location:** `robotics/robots.tsx` lines 167–178, `robotics/missions.tsx` lines 130–141
**Description:** The Robots and Missions pages implement their own inline 4-column stat grids using raw divs, while Dashboard, Inbox, Observability, and Governance use the shared `<KpiRow>` component. The stats look slightly different (no Card wrapper in the robots version).
**Recommendation:** Refactor the inline stat grids to use `<KpiRow>` for consistency.

### 7.2 — Minor: Safety page uses raw `<table>` HTML instead of DataTable component

**Location:** `robotics/safety.tsx` lines 69–85, 94–109, 117–133
**Description:** Three tables on the Safety page are implemented as raw HTML `<table>` elements with manual `thead/tbody/tr/td`. Every other data display in the cockpit uses the shared `<DataTable>` component. The raw tables lack hover states, accessibility roles, and pagination.
**Recommendation:** Refactor the three safety tables to use `<DataTable>` with appropriate column definitions. The "Add Constraint" and "Edit" actions can be passed as column renderers.

### 7.3 — Minor: WorkItem detail page doesn't use RelatedEntities panel

**Location:** `work-items/$workItemId.tsx`
**Description:** The Work Item detail page manually renders "Linked Runs" and "Linked Approvals" in its own card layout. Run detail and Approval detail pages use the shared `<RelatedEntities>` component for cross-links. This means the Work Item page looks structurally different from the rest and misses the grouped-by-type layout that RelatedEntities provides.
**Recommendation:** Migrate the work item's linked entities (runs, approvals, evidence) to use `<RelatedEntities>` for a consistent detail page pattern.

### 7.4 — Minor: ApprovalDetailPage status badge placement is inconsistent with other detail pages

**Location:** `approvals/$approvalId.tsx` lines 140–152
**Description:** The approval status badge is rendered outside the `PageHeader` component, floating to the right in a custom flex row. Run detail shows status badges in a `flex flex-wrap` row _below_ the header. Work Item detail shows the badge inside a Card. There is no consistent "where does the entity status live on a detail page" pattern.
**Recommendation:** Standardize: status badge should be rendered in a dedicated status row immediately below the `PageHeader`, across all detail pages.

---

## 8. Onboarding and Discoverability

### 8.1 — Critical: No onboarding or first-use guidance

**Location:** Global
**Description:** A new user opening the cockpit for the first time sees the sidebar, the workspace ID "ws-demo" in the footer, and whichever page they land on. There is no welcome state, no contextual tooltips, no guided tour, and no help system. The domain vocabulary (Runs, Approvals, Evidence, SoD, Execution Tier, SPIFFE SVID) is highly specialized and non-intuitive to someone unfamiliar with the Portarium domain.
**Recommendation:** At minimum, add a dismissible banner on the first visit (tracked in localStorage) that points users to the Inbox as the primary workflow entry point. Longer term, consider a brief "What is X?" tooltip on each section header in the sidebar.

### 8.2 — Major: "Inbox" entry in nav gives no indication of unread/pending count

**Location:** `__root.tsx` line 27
**Description:** The Inbox nav item has no badge counter. When there are pending approvals or blocked runs, this is the most time-critical screen but nothing in the nav communicates urgency. Contrast with the `count` badges inside the Inbox and Approvals pages themselves.
**Recommendation:** Display a badge on the Inbox nav item showing total actionable items (pending approvals + blocked runs). This should use the same data already fetched on the Inbox page. A red dot or count badge is standard UX for notification-style nav items.

### 8.3 — Minor: Sidebar "ws-demo" workspace identifier is cryptic

**Location:** `__root.tsx` line 218
**Description:** The sidebar footer shows `ws-demo` as the workspace identifier. This is a raw ID, not a human name. For an enterprise platform used by multiple teams across sites, understanding which workspace you are in is critical to avoiding operational errors.
**Recommendation:** Show the workspace display name ("Demo Workspace" or "Meridian Cold Chain") with the ID as secondary text. This data is available from `useUIStore`.

---

## 9. The "Connected to" Related Entities Panel

### 9.1 — Minor: No visual indication when entities are non-navigable

**Location:** `related-entities.tsx` lines 102–122
**Description:** `RelatedEntities` renders entities as either `<Link>` (with `href`) or `<span>` (without). Items without an `href` (e.g., workflows referenced by ID but no route yet) render as static spans that look visually identical to links except for hover behavior. A user cannot tell at a glance which entities are navigable.
**Recommendation:** Apply a visually distinct style to non-navigable entities: either a muted/greyed pill, or a subtle `cursor-default` style. Consider adding a `cursor-not-allowed` with a tooltip like "Detail view not yet available".

### 9.2 — Minor: RelatedEntities panel has no explicit section header explanation

**Location:** `related-entities.tsx` line 75
**Description:** The panel title defaults to "Connected to" which is a slightly abstract label. New users may not understand whether this section shows entities that this record _depends on_ vs. entities that _depend on_ this record, vs. a flat list of related records.
**Recommendation:** Consider splitting into "Dependencies" (upstream) and "Impact" (downstream) if the data model supports it. At minimum, a description line under the card title would help: "Other records linked to this approval".

---

## 10. Dashboard — Useful or Decorative?

### 10.1 — Major: Dashboard has no clear user goal

**Location:** `dashboard.tsx`
**Description:** The dashboard shows: KPI row (Active Runs, Pending Approvals, Completed Today, SLA at Risk), a "Recent Work Items" table (last 5), a "Pending Approvals" list (last 5), and an "Active Runs" table (last 6). This is a standard "summary view" but provides no next action. Every item on the dashboard requires the user to click away to act — none of the items are actionable in-place. Compare with the Inbox, which is action-oriented.
**Recommendation:** The Dashboard should answer "What do I need to do right now?" The Inbox already does this better. The Dashboard should be repositioned as a management/monitoring view — showing trends, SLA health over time, and team workload — while the Inbox remains the default landing for operators. Remove the "Pending Approvals" section from the Dashboard (it duplicates the Inbox) and instead show a 7-day trend chart of run outcomes.

### 10.2 — Minor: Pending Approvals section on Dashboard shows status badge that is always "Pending"

**Location:** `dashboard.tsx` lines 180–195
**Description:** The Pending Approvals list in the dashboard shows an `ApprovalStatusBadge` next to each approval. Since the list is pre-filtered to `status === 'Pending'`, every badge will always show "Pending". This is noise with zero information value.
**Recommendation:** Remove the status badge from this view. The status is already communicated by the card title "Pending Approvals".

### 10.3 — Minor: Dashboard "SLA at Risk" KPI counts items in next 24h but doesn't link to them

**Location:** `dashboard.tsx` lines 52–56
**Description:** The "SLA at Risk" count is computed but clicking the KPI card does nothing. It should navigate to the Work Items page filtered to at-risk items.
**Recommendation:** Make KPI cards in the Dashboard clickable where there is a meaningful navigation target. Use a `Link` wrapper or `onClick` navigation.

---

## 11. Mobile and Responsive Considerations

### 11.1 — Major: Layout is not mobile-friendly

**Location:** `__root.tsx` lines 174–229
**Description:** The root layout uses `flex h-screen` with a fixed sidebar. The sidebar width switches between `w-16` (collapsed) and `w-64` (expanded) with no mobile breakpoint handling. On screens below ~768px, the fixed sidebar combined with the `flex-1` main content will cause the sidebar to compress main content to an unusably narrow area. There is no hamburger menu, no mobile drawer, and no responsive nav pattern.
**Recommendation:** For an operations tool used on tablets (common in warehouse/logistics environments), add a mobile nav: sidebar becomes a slide-out drawer on small screens, triggered by a hamburger icon. This is a `Major` severity issue given the cold-chain/logistics context where tablets at workstations are likely.

### 11.2 — Minor: Approval Triage card (`max-w-2xl`) fits well on desktop but may be tight on a 768px tablet

**Location:** `approval-triage-card.tsx` line 488
**Description:** The triage card is `max-w-2xl mx-auto`. The card body contains multiple sections (SoD banner, policy rule, history, effects, decision area) stacked vertically. On a narrow tablet, this could require significant scrolling to reach the action buttons.
**Recommendation:** On smaller screens, collapse secondary sections (policy rule, decision history) into a disclosure/accordion that expands on demand, keeping the action buttons closer to the content summary.

### 11.3 — Minor: 4-column robot class filter chips wrap poorly on narrow screens

**Location:** `robotics/robots.tsx` line 181
**Description:** The class filter buttons (`flex flex-wrap gap-2`) wrap correctly, but on mobile the robot card grid collapses from `lg:grid-cols-3 sm:grid-cols-2` to single column correctly. However, the detail sheet (`w-[420px] sm:w-[480px]`) is wider than a typical mobile screen and will cause horizontal overflow.
**Recommendation:** Add a full-width (`w-full`) fallback for the Sheet on screens below sm breakpoint.

---

## 12. Typography and Colour Usage

### 12.1 — Minor: Inconsistent font size floor — some labels use `text-[10px]`, others `text-[11px]`

**Location:** Multiple components
**Description:** Several components mix `text-[10px]` and `text-[11px]` for small labels. At the base 14px document size, `text-[10px]` (10px) is below WCAG AA minimum for normal text (which recommends 12px for body text). Specific instances:

- `approval-triage-card.tsx` uses `text-[10px]` for section header labels (line 335)
- `related-entities.tsx` uses `text-[9px]` for entity badges (line 95)
- `kpi-row.tsx` uses `text-[11px]` for trend values

**Recommendation:** Establish a minimum text size of `text-[11px]` (11px) for the smallest visible labels, and `text-xs` (12px) as the default minimum for informational text. The `text-[9px]` instance in `related-entities.tsx` should be elevated to at minimum `text-[10px]`.

### 12.2 — Minor: Hardcoded HSL colors in badge components bypass the design token system

**Location:** `robotics/robots.tsx` lines 26–29, `robotics/safety.tsx` lines 17–22, `approval-triage-card.tsx` lines 236–239
**Description:** Status badges use raw Tailwind color classes like `bg-green-100 text-green-800 border-green-200` instead of semantic design tokens (`--success`, `--warning`, etc.). In the Midnight theme (dark background), `bg-green-100` will look visually inconsistent because it's a light green that doesn't account for the dark background context.
**Recommendation:** Use semantic token classes (`bg-success text-success-foreground`) defined in the theme system, or define dark-mode overrides for the hardcoded badge colors using `dark:` variants. This ensures Midnight theme users see appropriate color contrast.

### 12.3 — Minor: Three themes exist but there is no visual indicator of the active theme in the UI outside Settings

**Location:** `config/settings.tsx`, `__root.tsx`
**Description:** The active theme is applied via `useTheme()` hook but there is no in-context theme indicator. A user cannot tell which theme is active without going to Settings.
**Recommendation:** Add the current theme name (e.g., "Arctic Ops") as a subtle indicator in the sidebar footer alongside the workspace ID. This also serves as a prompt to explore themes.

### 12.4 — Minor: SoD banner in triage card uses raw green/red HSL background colors, not design tokens

**Location:** `approval-triage-card.tsx` lines 263, 278
**Description:** The `SodBanner` component uses `bg-green-50 border-green-200` and `bg-red-50 border-red-200`. These are fine in Arctic Ops (light theme) but will appear very low contrast in Midnight theme because green-50 over a navy background is nearly invisible.
**Recommendation:** Use the semantic token backgrounds: `bg-success/10 border-success/30` (for eligible state) and `bg-destructive/10 border-destructive/30` (for blocked states). These already exist in the design system.

---

## 13. Additional Findings

### 13.1 — Critical: Mock violations in Inbox are hardcoded and will ship to production

**Location:** `inbox.tsx` lines 104–118
**Description:** `MOCK_VIOLATIONS` is a hardcoded array of two policy violations with specific IDs (`pv-001`, `pv-002`), timestamps, and titles referencing real-sounding incidents. The comment says "in production these come from evidence/governance" but no API integration exists. If this ships as-is, users will always see these two fake violations.
**Recommendation:** Replace with a real API call to the governance/evidence layer. If the API is not ready, render the section only when data is available, with an empty state. Never ship hardcoded fictional violations.

### 13.2 — Major: BreadcrumbLink in PageHeader uses `href` (hard navigation) instead of router Link

**Location:** `page-header.tsx` lines 30–33
**Description:** `<BreadcrumbLink href={item.to}>` uses a plain `href` attribute, which will cause a full page reload instead of client-side navigation. This breaks the SPA experience and loses any in-memory query cache.
**Recommendation:** Replace with the TanStack Router `<Link>` component:

```tsx
import { Link } from '@tanstack/react-router';
// ...
<BreadcrumbLink asChild>
  <Link to={item.to}>{item.label}</Link>
</BreadcrumbLink>;
```

### 13.3 — Minor: Approval detail page loads full runs list to find one run

**Location:** `approvals/$approvalId.tsx` lines 30–31
**Description:** `useRuns(wsId)` fetches the entire runs list to find the single run linked to this approval. At scale (300+ runs as in `meridian-full` dataset), this is wasteful and slows the detail page unnecessarily.
**Recommendation:** Add a `useRun(wsId, runId)` query (already exists in `use-runs` for the run detail page) called with `approval.runId` once the approval data is available. This is a minor concern in the demo but a meaningful performance issue at production scale.

---

## Summary Table

| #    | Severity | Area             | Finding                                                    |
| ---- | -------- | ---------------- | ---------------------------------------------------------- |
| 1.1  | Major    | Navigation       | No default landing route / root redirect                   |
| 1.2  | Minor    | Navigation       | "Work" / "Workspace" section label confusion               |
| 1.3  | Minor    | Navigation       | Collapsed sidebar has no tooltips                          |
| 1.4  | Minor    | Navigation       | Unimplemented routes not marked "Coming soon"              |
| 2.1  | Major    | Visual Hierarchy | Dashboard uses wrong page icon                             |
| 2.2  | Minor    | Visual Hierarchy | "New Run" CTA has no handler                               |
| 2.3  | Minor    | Visual Hierarchy | KPI trend data never populated                             |
| 3.1  | Critical | Approvals        | Deny rationale requirement not communicated                |
| 3.2  | Major    | Approvals        | Skipped triage items silently dropped                      |
| 3.3  | Minor    | Approvals        | Keyboard shortcuts not visible without scroll              |
| 3.4  | Critical | Approvals        | SoD/policy data hardcoded on approval ID — compliance risk |
| 3.5  | Minor    | Approvals        | Triage swipe metaphor unexplained                          |
| 4.1  | Minor    | Empty States     | Default empty state is generic and action-less             |
| 4.2  | Minor    | Empty States     | Evidence empty state lacks onboarding context              |
| 5.1  | Minor    | Error States     | Observability page has no error state                      |
| 5.2  | Minor    | Error States     | Governance page uses primitive loading text                |
| 5.3  | Major    | Error States     | Run detail page doesn't handle null run after load         |
| 6.1  | Minor    | Data Density     | Runs/Work Items pages lack KPI summary row                 |
| 6.2  | Minor    | Data Density     | Safety page uses excessive `space-y-8`                     |
| 6.3  | Minor    | Data Density     | "Test ↺" button on robot cards has no handler              |
| 7.1  | Minor    | Consistency      | Robotics stat grids don't use shared KpiRow                |
| 7.2  | Minor    | Consistency      | Safety tables use raw HTML instead of DataTable            |
| 7.3  | Minor    | Consistency      | Work Item detail doesn't use RelatedEntities               |
| 7.4  | Minor    | Consistency      | Status badge placement inconsistent across detail pages    |
| 8.1  | Critical | Onboarding       | No first-use guidance or onboarding                        |
| 8.2  | Major    | Onboarding       | Inbox nav item has no pending count badge                  |
| 8.3  | Minor    | Onboarding       | Workspace identifier is a raw ID, not a display name       |
| 9.1  | Minor    | Related Entities | Non-navigable entities indistinguishable from links        |
| 9.2  | Minor    | Related Entities | "Connected to" label lacks directional clarity             |
| 10.1 | Major    | Dashboard        | Dashboard has no clear user goal / action pathway          |
| 10.2 | Minor    | Dashboard        | Status badge redundant on pre-filtered approval list       |
| 10.3 | Minor    | Dashboard        | SLA at Risk KPI is not clickable/navigable                 |
| 11.1 | Major    | Responsive       | No mobile/tablet responsive navigation pattern             |
| 11.2 | Minor    | Responsive       | Triage card scrolls too much on narrow tablet              |
| 11.3 | Minor    | Responsive       | Robot detail sheet overflows mobile viewport               |
| 12.1 | Minor    | Typography       | Sub-11px text used in several label components             |
| 12.2 | Minor    | Colour           | Badge colors bypass design token system                    |
| 12.3 | Minor    | Colour           | Active theme not indicated outside Settings                |
| 12.4 | Minor    | Colour           | SoD banner colors incompatible with Midnight theme         |
| 13.1 | Critical | Data Integrity   | Hardcoded mock violations will ship to production          |
| 13.2 | Major    | Navigation       | BreadcrumbLink uses hard reload instead of router Link     |
| 13.3 | Minor    | Performance      | Approval detail fetches all runs to find one               |

---

## Prioritized Recommendations

**Fix immediately (Criticals):**

1. Replace hardcoded SoD evaluations with real API data (compliance risk)
2. Replace hardcoded mock violations in Inbox with real API call or empty state
3. Add onboarding/first-use guidance (discovery)
4. Communicate Deny rationale requirement more clearly

**Fix before next release (Majors):** 5. Add default `/` → `/inbox` redirect 6. Fix BreadcrumbLink to use client-side router Link 7. Add pending count badge to Inbox nav item 8. Handle null run state in Run detail page 9. Implement mobile-responsive navigation pattern 10. Reposition Dashboard as monitoring view, not triage duplicate

**Polish in next sprint (Minors):** 11. Standardize status badge placement on detail pages 12. Normalize typography sizes (remove sub-11px labels) 13. Fix badge colors to use design system semantic tokens 14. Add tooltips to collapsed sidebar items 15. Mark unimplemented routes as "Coming soon"
