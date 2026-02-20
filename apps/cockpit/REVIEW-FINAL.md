# Cockpit Final Verification Review

**Reviewer:** Final UX/Engineering Agent
**Date:** 2026-02-20
**Scope:** Post-batch-fix verification of all critical items from prior reviews

---

## Verified Fixes

| #   | Fix                                                              | Status | Notes                                                                                                                     |
| --- | ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | Error boundary wrapping routes in `__root.tsx`                   | ✅     | `<ErrorBoundary>` wraps `<Outlet />` at line 372                                                                          |
| 2   | `useEffect` dep array fixed in `approval-triage-card.tsx`        | ✅     | `handleAction` added to dep array via `useCallback`, `[isBlocked, loading, rationale, requestChangesMode, handleAction]`  |
| 3   | `isError` state on approvals list page                           | ✅     | Error banner with Retry button in `approvals/index.tsx`                                                                   |
| 4   | `isError` state on runs list page                                | ✅     | Error banner with Retry button in `runs/index.tsx`                                                                        |
| 5   | `isError` state on work-items list page                          | ✅     | Error banner with Retry button in `work-items/index.tsx`                                                                  |
| 6   | `isError` state on agents page                                   | ✅     | Error banner with Retry button in `config/agents.tsx`                                                                     |
| 7   | `isError` state on adapters page                                 | ✅     | Error banner with Retry button in `config/adapters.tsx`                                                                   |
| 8   | `isError` state on workforce page                                | ❌     | No workforce list route reviewed — not in file set; cannot confirm                                                        |
| 9   | `BreadcrumbLink` uses TanStack Router `Link` (not `href`)        | ✅     | `page-header.tsx` line 33–35: `<BreadcrumbLink asChild><Link to={item.to}>`                                               |
| 10  | `MOCK_VIOLATIONS` removed from `inbox.tsx`                       | ✅     | No `MOCK_VIOLATIONS` present; only a placeholder comment at line 159-161                                                  |
| 11  | SoD/policy data on `approval.sodEvaluation` not hardcoded per-ID | ✅     | `approval-triage-card.tsx` reads `approval.sodEvaluation ?? DEFAULT_SOD_EVALUATION` — no per-ID switch                    |
| 12  | Pending count badge on Inbox nav item in `__root.tsx`            | ✅     | `InboxBadge` component (lines 228-237) renders when `pendingCount > 0`                                                    |
| 13  | Filter state in URL params (not `useState`) in runs              | ✅     | `Route.useSearch()` + `validateSearch` in `runs/index.tsx` lines 50-54, 171-175                                           |
| 14  | Filter state in URL params (not `useState`) in work-items        | ✅     | `Route.useSearch()` + `validateSearch` in `work-items/index.tsx` lines 34-38, 165-169                                     |
| 15  | "Show skipped" recovery in approvals triage                      | ✅     | `approvals/index.tsx` lines 176-184: Button shown when `triageSkipped.size > 0`, calls `setTriageSkipped(new Set())`      |
| 16  | Recharts lazy-loaded in observability                            | ✅     | `observability.tsx`: `const ObservabilityChart = lazy(...)` with `<Suspense>` wrapper                                     |
| 17  | `DataTable` has `overflow-x-auto` wrapper                        | ✅     | `data-table.tsx` line 122: `<div className="overflow-x-auto">` wraps `<Table>`                                            |
| 18  | `KpiRow` uses responsive grid classes (not inline style)         | ✅     | `kpi-row.tsx` line 18: `className="grid grid-cols-2 md:grid-cols-4 gap-3"`                                                |
| 19  | Skip-to-content link in `__root.tsx`                             | ✅     | Lines 249-254: `<a href="#main-content" className="sr-only focus:not-sr-only ...">`                                       |
| 20  | `aria-label` on nav element                                      | ✅     | `__root.tsx` line 286: `<nav aria-label="Primary navigation">`                                                            |
| 21  | `Toaster` component in `__root.tsx`                              | ✅     | Line 381: `<Toaster position="bottom-right" />` (sonner)                                                                  |
| 22  | `comingSoon` items in nav for Workflows                          | ✅     | `NAV_SECTIONS` line 72: `comingSoon: true` on Workflows item                                                              |
| 23  | `comingSoon` for Gateways                                        | ❌     | Gateways nav item (`/robotics/gateways`) has NO `comingSoon` flag — it is a live link but the route may not be registered |

**Summary: 21/23 confirmed fixes. 2 items could not be fully verified (workforce `isError` not in scope; Gateways `comingSoon` missing).**

---

## Regressions Found

### 1. `InboxBadge` — unconditional network call in root layout

`InboxBadge` always calls `useApprovals(wsId)` on every page load, even for non-Approver personas. This is a minor performance regression introduced by the badge fix. No functional breakage but adds a background query to every page render.

### 2. `evidence/index.tsx` — filter uses `useState` not URL params

The evidence page uses `useState` for its category filter (`filterValues`). This is inconsistent with the fix applied to runs and work-items and means filter state is lost on navigation. Not a new regression but was not addressed in this batch.

### 3. `missions.tsx` — stats grid uses fixed `grid-cols-4`

`MissionsPage` uses `className="grid grid-cols-4 gap-3"` without responsive breakpoints. On small screens (< 640px) this will overflow. The KpiRow fix was not applied here. Minor visual regression risk.

### 4. `work-items/$workItemId.tsx` — no `isError` or not-found guard

If `useWorkItem` returns `isError`, the component shows an indefinite loading skeleton (the guard only checks `itemLoading || !item`). On a network error the page hangs forever.

### 5. Gateways nav link is live but the route page likely does not exist

`/robotics/gateways` appears in the nav without `comingSoon: true`, but no `gateways.tsx` route was found in the file set. Clicking this link will likely render nothing or throw a 404 in the router.

---

## Remaining Gaps

1. **Workforce list page** — `isError` state not confirmed; likely missing per the original review findings and the route was not included in the review set.

2. **Evidence page filter** — uses `useState` for `category` filter instead of URL search params; breaks deep-linking and browser back button behavior.

3. **Approval detail page** — `approval.sodEvaluation` data now comes from the fixture, but the `ApprovalGatePanel` (not reviewed in this file set) may still have its own hardcoded SoD logic. Risk not eliminated end-to-end.

4. **`robots.tsx` KPI block** — uses a hand-rolled `grid grid-cols-2 sm:grid-cols-4` card block instead of the shared `KpiRow` component. Diverges from the design system going forward.

5. **Safety tables** — `safety.tsx` uses raw `<table>` elements rather than `DataTable`. No `overflow-x-auto` wrapper, so wide tables will overflow on mobile.

6. **No `aria-label` on filter bar group** — `FilterBar` select controls lack an accessible group label tying the filters to the table they control.

7. **`related-entities.tsx`** — uses `to={entity.href}` passed as a string path to TanStack Router `Link`. Dynamic `href` paths like `/runs/${id}` must be cast (`as string`) to avoid type errors; this is done in callsites but is fragile.

8. **`SorRefPill` external URL** — validates `deepLinkUrl` with a regex for `https?://`. Safe, but does not sanitize the rest of the URL (e.g., `javascript:` with a space prefix). Low risk in a demo context, but worth a note.

9. **No loading/error state in `ExploreEventsPage`** — `explore/events.tsx` has no `isError` branch. Live events page will silently show empty if the fetch fails.

10. **Workspace selector in sidebar** — workspace change via `setActiveWorkspaceId` updates the Zustand store but does not trigger a page reload or query invalidation, so stale data from the previous workspace could be shown briefly. The dataset selector does reload (`window.location.reload()`), but the workspace selector does not.

---

## Quality Scores

### UX: 7.5 / 10

The cockpit covers its domain well. The triage card with keyboard shortcuts, live badge counts, and human task drawer are genuinely strong UX. Inbox is clean and purposeful. Score is held back by: inconsistent filter persistence (evidence vs runs/work-items), mobile layout issues in missions/safety tables, missing `isError` on events page, and the dangling Gateways nav link.

### Accessibility: 6.5 / 10

Major wins: skip-to-content link, `aria-label` on nav, keyboard shortcuts with `aria-keyshortcuts`, `tabIndex`/`role="button"` on table rows, `aria-label` on sensitive actions (E-Stop). Gaps: FilterBar lacks accessible group label, SoD/policy banners use `role="status"` inconsistently (some "alert", some "status"), mission stats and safety tables have no `aria-label`, and the sidebar collapsed state does not announce to screen readers.

### Code Quality: 7.5 / 10

Architecture is clean: URL-driven filters, typed search params, centralized mock handlers, Zustand store is minimal. `useCallback` dep array fix is correct. Lazy loading Recharts is correct. DataTable overflow fix is clean. Gaps: `evidence/index.tsx` and `robots.tsx` deviate from the patterns just established, `work-items/$workItemId.tsx` has an incomplete error guard, and raw `<table>` elements in safety diverge from the shared component system.

---

## Top 5 Remaining Actions (by impact)

1. **Add `isError` guard to `work-items/$workItemId.tsx` and `explore/events.tsx`** — currently these pages silently hang or show empty on API failure, which is a user-facing correctness bug.

2. **Add `comingSoon: true` to the Gateways nav item (or register the route)** — a nav link with no backing route will crash the router for any user who clicks it.

3. **Migrate evidence page filter to URL search params** — aligns with the runs/work-items pattern and makes the filter state shareable/bookmarkable.

4. **Add `isError` handler to the workforce members list route** — the original review flagged this; confirm and fix.

5. **Add `overflow-x-auto` wrapper to safety and missions tables** — the raw `<table>` elements in `safety.tsx` and the `grid-cols-4` in `missions.tsx` will break on mobile viewports; applying the same pattern used in `DataTable` is a one-line fix.
