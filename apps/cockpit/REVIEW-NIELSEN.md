# Nielsen Heuristics Audit — Portarium Cockpit UI

**Reviewer:** Usability Expert (Haiku Agent)
**Date:** 2026-02-20
**Scope:** All primary routes, components, and the shared layout shell

---

## Executive Summary

The cockpit UI is well-structured and domain-coherent, with strong use of status badges, breadcrumbs, and contextual data. However, the audit surfaced **27 findings** across all 10 heuristics. The most serious issues concentrate in three areas:

1. **System status visibility** — loading states often collapse to plain text with no structural feedback; global error states are missing.
2. **Error recovery** — error paths for many list views (non-detail pages) produce no message and no recovery action.
3. **User control & freedom** — destructive decisions in Robotics (E-Stop, mission cancel) lack a clear "undo" path once committed, and several navigation gaps trap users in dead ends.

Severity scale: **Critical** (blocks core task), **Major** (degrades task completion), **Minor** (friction without task failure).

---

## Heuristic 1 — Visibility of System Status

### Finding 1.1 — Generic loading text across many pages
- **Severity:** Major
- **Location:** `routes/explore/observability.tsx` line 61; `routes/explore/governance.tsx` line 110; `routes/explore/events.tsx` line 39
- **Description:** When data is loading the component renders `<div className="text-xs text-muted-foreground">Loading...</div>`. This is unstructured plain text: no spinner, no skeleton, no progress indicator. Users cannot distinguish a fast load from a hung request.
- **Recommendation:** Use the shared `<Skeleton>` component (already used in detail pages). Provide a skeleton layout that matches the expected content shape (e.g. chart placeholder for Observability, timeline rows for Events).

### Finding 1.2 — DataTable loading shows wrong row count
- **Severity:** Minor
- **Location:** `components/cockpit/data-table.tsx` lines 86–110
- **Description:** The loading skeleton always renders exactly 5 rows regardless of the expected result set or previous data. On pages that routinely show 1–3 items this creates a jarring layout jump.
- **Recommendation:** Accept an optional `loadingRows` prop (defaulting to 5); callers with known small result sets (e.g. Linked Runs in work-item detail) can pass a lower value.

### Finding 1.3 — Evidence timeline has no empty loading message
- **Severity:** Minor
- **Location:** `components/cockpit/evidence-timeline.tsx` line 30
- **Description:** When `loading=true` the timeline renders skeletons. When `loading=false` and `entries` is empty, nothing is rendered — the component returns an empty `<div>`. Callers must independently handle the empty state.
- **Recommendation:** Render an inline empty state inside `EvidenceTimeline` when `entries.length === 0 && !loading`, so each call-site doesn't need to replicate this logic.

### Finding 1.4 — No "last refreshed" indicator on live Event stream
- **Severity:** Minor
- **Location:** `routes/explore/events.tsx` lines 31–37
- **Description:** The page shows a pulsing green "LIVE" dot and refreshes every 5 seconds, but there is no timestamp showing when data was last successfully fetched. Users have no way to confirm whether the animation means "connected" or merely "trying".
- **Recommendation:** Display a "Last updated X seconds ago" counter updated on each successful query, using React Query's `dataUpdatedAt` field.

---

## Heuristic 2 — Match Between System and the Real World

### Finding 2.1 — "Runs" terminology not explained
- **Severity:** Minor
- **Location:** `routes/runs/index.tsx` line 110; nav in `routes/__root.tsx` line 39
- **Description:** "Runs" is domain jargon. New users have no tooltip, glossary link, or inline explanation to distinguish a Run from a Workflow or Work Item. The filter labels "Tier: HumanApprove" and "Tier: ManualOnly" are also internal code names rather than natural language.
- **Recommendation:** Add tooltip or description text to the page header ("Runs represent individual executions of a Workflow"). Humanise filter labels: "Human Approve" → "Requires human approval", "ManualOnly" → "Manual only".

### Finding 2.2 — "SoD" abbreviation unexplained in Governance page
- **Severity:** Minor
- **Location:** `routes/explore/governance.tsx` lines 20–38; `components/cockpit/approval-triage-card.tsx` lines 260–315
- **Description:** "SoD" (Segregation of Duties) appears without expansion in the KPI label "SoD Constraints Active", the table title, and the triage card banner. Non-compliance users (e.g. ops staff) may not know the term.
- **Recommendation:** Expand the acronym on first use with a title attribute or parenthetical: "SoD (Segregation of Duties) Constraints Active".

### Finding 2.3 — Triage card shows "A / D / R / S" keyboard hints but not in accessible language
- **Severity:** Minor
- **Location:** `components/cockpit/approval-triage-card.tsx` lines 731–748
- **Description:** Keyboard shortcut hints use single letters (A, D, R, S) with brief labels below them. The shortcut for "R" is labelled "changes" which does not map obviously to "Request changes". The shortcut for "S" means "Skip", which could be confused with "Submit".
- **Recommendation:** Use clearer labels: "changes" → "req. changes", "skip" → "skip item". Also add an `aria-keyshortcuts` attribute to each button so screen reader users discover the shortcuts.

---

## Heuristic 3 — User Control and Freedom

### Finding 3.1 — No undo after E-Stop is confirmed
- **Severity:** Critical
- **Location:** `routes/robotics/robots.tsx` lines 129–136; `routes/robotics/safety.tsx` lines 143–147
- **Description:** After the user clicks "Confirm" in the E-Stop confirmation dialog, the action is committed immediately in local state with no server-side persistence shown and no undo. The safety page offers "Clear E-Stop" but this requires a separate admin dialog with a rationale field — it is not presented as a natural undo of the action just taken.
- **Recommendation:** After confirmation, immediately show the "Clear E-Stop" option in a prominent position adjacent to where the action was triggered (the header area), not only in the status banner. Add a brief toast notification with a "Clear E-Stop" affordance within a configurable grace period.

### Finding 3.2 — Mission cancel button in table has no confirmation step
- **Severity:** Major
- **Location:** `routes/robotics/missions.tsx` line 121
- **Description:** The "Cancel" button for Pending missions in the DataTable column opens the mission detail sheet (setSelectedMission), where a separate confirmation lives. However, only the "Pre-empt" and "Retry" buttons in the table column open the sheet; "Cancel" for Pending missions also calls setSelectedMission but the label says "Cancel" directly in the row — users may expect an immediate action, not a drill-down.
- **Recommendation:** Rename the table-row action to "Review & Cancel" to signal that clicking opens a details panel rather than performing an immediate cancel.

### Finding 3.3 — Triage card skip does not offer path back to skipped items
- **Severity:** Major
- **Location:** `routes/approvals/index.tsx` lines 25–50
- **Description:** Once an approval is skipped (`triageSkipped`), it is removed from the visible queue for the session. There is no UI to "show skipped items" or undo a skip. The only way to see those items again is to reload the page.
- **Recommendation:** Add a "Show skipped (N)" link below the triage card that removes the item from the skipped set. Alternatively, add a "Skipped" tab alongside "Pending", "Triage", "All".

### Finding 3.4 — No back navigation from workforce queue detail
- **Severity:** Minor
- **Location:** `routes/workforce/queues.tsx` — no row-click handler
- **Description:** The Queues page lists queues in a DataTable but has no `onRowClick` and no queue-detail route. This is not necessarily a bug, but if users expect to drill into a queue (e.g. to see its members), there is no path forward and no indication that the row is non-interactive.
- **Recommendation:** If a queue detail page is not available, add `cursor-default` styling so rows do not show a pointer, and add an empty state or tooltip explaining that queue management is done via the admin panel.

---

## Heuristic 4 — Consistency and Standards

### Finding 4.1 — Two inconsistent empty-state patterns
- **Severity:** Major
- **Location:** `routes/inbox.tsx` line 188 vs `components/cockpit/empty-state.tsx`; `routes/evidence/index.tsx` line 65
- **Description:** Some pages use the shared `<EmptyState>` component (Evidence, Approvals triage). Others render ad-hoc inline text (`<div className="px-3 py-4 text-sm text-muted-foreground italic">No pending approvals.</div>`). The visual weight, iconography, and copy format differ, creating an inconsistent feel.
- **Recommendation:** Migrate all ad-hoc empty states to the shared `<EmptyState>` component. The Inbox sections and dashboard cards are the primary violators.

### Finding 4.2 — Inconsistent loading indicator approaches
- **Severity:** Major
- **Location:** Compare `routes/runs/$runId.tsx` line 87 (Skeleton), `routes/explore/events.tsx` line 39 (EvidenceTimeline with loading prop), `routes/explore/governance.tsx` line 110 (plain text)
- **Description:** Three distinct loading patterns are used across the app: (a) `<Skeleton>` components, (b) passing `loading={isLoading}` to child components that self-manage, (c) inline `"Loading..."` text. This is inconsistent and unpredictable.
- **Recommendation:** Adopt a single pattern: pass `loading` to data-driven components that render their own skeleton. Reserve top-level `<Skeleton>` only for full-page loading states (before any data is shown). Remove plain text "Loading…" strings entirely.

### Finding 4.3 — Work-items owner filter uses raw user IDs
- **Severity:** Minor
- **Location:** `routes/work-items/index.tsx` lines 19–23
- **Description:** The Owner filter options show internal IDs as labels: `{ label: 'alex', value: 'user-ops-alex' }`. The label is a lowercase first name with no surname or role context, and the value leaks the internal ID scheme.
- **Recommendation:** Use display names that match what users see in the Workforce section (full name + role), and fetch them from the workforce members data rather than hard-coding.

### Finding 4.4 — "New Run" button on Dashboard has no analogous action on Runs list page
- **Severity:** Minor
- **Location:** `routes/dashboard.tsx` line 125 vs `routes/runs/index.tsx` (no action button)
- **Description:** The Dashboard `PageHeader` includes a "New Run" action button, but the Runs list page has no such button. Users who navigate to /runs expecting to create a run will not find the action.
- **Recommendation:** Add a "New Run" button to the Runs page header so the action is available from its natural context.

---

## Heuristic 5 — Error Prevention

### Finding 5.1 — Deny requires rationale but constraint is not surfaced until after click
- **Severity:** Major
- **Location:** `components/cockpit/approval-triage-card.tsx` lines 693–700
- **Description:** The "Deny" button is disabled until `rationale.trim()` is non-empty, but there is no indication next to the textarea that rationale is required for denial (only for denial). The helper text on line 675 says "Rationale is optional when approving, required when denying" but this appears below the textarea in small muted text. Users who click Deny first and find it disabled may not realise why.
- **Recommendation:** Add inline required indicator (`*`) and a short label to the textarea: "Required when denying". Surface this before the action buttons, not after.

### Finding 5.2 — E-Stop confirmation dialog text says "irreversible" but UI offers "Clear"
- **Severity:** Major
- **Location:** `routes/robotics/safety.tsx` line 141
- **Description:** The confirmation dialog states "This action is irreversible until manually cleared." This is technically true but misleads users into thinking there is no recovery path. The safety page prominently shows "Clear E-Stop (admin)" immediately after activation.
- **Recommendation:** Reword to: "All robots will be halted immediately. A separate 'Clear E-Stop' step (admin-only) is required to resume operations. This action will be logged."

### Finding 5.3 — No SLA due-date warning at point of work-item creation/edit
- **Severity:** Minor
- **Location:** `routes/work-items/index.tsx` — no creation affordance exists
- **Description:** The dashboard shows "SLA at Risk" KPI but work items have no creation flow in the UI. Once an SLA is overdue, the only visible signal is on the dashboard. The detail page shows the due date statically but without contextual urgency cues.
- **Recommendation:** On the work-item detail page, add a prominent badge ("SLA Overdue" / "SLA at Risk") near the due date when conditions are met, matching the same logic used on the dashboard.

---

## Heuristic 6 — Recognition Rather Than Recall

### Finding 6.1 — Run IDs truncated to 12 characters with no tooltip
- **Severity:** Major
- **Location:** `routes/runs/index.tsx` line 65; `routes/approvals/index.tsx` line 58; multiple other files
- **Description:** Run IDs and Approval IDs are truncated to the first 12 characters across all list views. There is no `title` attribute, tooltip, or copy affordance. Users who need to correlate a full ID with an external system must navigate to the detail page.
- **Recommendation:** Add `title={row.runId}` to the `<span>` containing the truncated ID, and optionally a clipboard copy icon on hover.

### Finding 6.2 — Filter state is not preserved on navigation
- **Severity:** Major
- **Location:** `routes/runs/index.tsx` lines 44–47; `routes/work-items/index.tsx` lines 28–31; `routes/approvals/index.tsx` lines 25–26
- **Description:** Filter values are stored in `useState` and reset when users navigate away and return. A user who filters runs to "Failed" to investigate, clicks one, and returns must re-apply the filter.
- **Recommendation:** Persist filter state in the URL search params (`useSearchParams` or TanStack Router's `search` property), so filters survive navigation and can be bookmarked or shared.

### Finding 6.3 — Workforce capabilities shown as abbreviated tags
- **Severity:** Minor
- **Location:** `routes/workforce/index.tsx` line 59; `routes/workforce/queues.tsx` line 52
- **Description:** Capability badges use `cap.split('.').pop()` which shows only the last segment of a dotted string (e.g. "approve" from "finance.approve"). On the member detail page the full string is shown. This inconsistency means users on the list view see truncated, potentially ambiguous labels.
- **Recommendation:** Show the full capability string on hover via `title` attribute, or show the full string in the list. Establish a single display convention and apply it everywhere.

---

## Heuristic 7 — Flexibility and Efficiency of Use

### Finding 7.1 — No keyboard navigation for DataTable rows
- **Severity:** Major
- **Location:** `components/cockpit/data-table.tsx` lines 133–146
- **Description:** Clickable table rows have an `onClick` handler but no keyboard handler (`onKeyDown`) and no `tabIndex`. Keyboard-only users cannot navigate or activate rows.
- **Recommendation:** Add `tabIndex={0}` and an `onKeyDown` handler (`if (e.key === 'Enter' || e.key === ' ') onRowClick?.(row)`) to each interactive row. Set `role="row"` and `aria-label` appropriately.

### Finding 7.2 — No bulk action for approvals in list view
- **Severity:** Minor
- **Location:** `routes/approvals/index.tsx` lines 132–141
- **Description:** The "Pending" tab lists pending approvals but there is no way to approve or deny multiple items at once. High-throughput approvers must triage each item individually from the table.
- **Recommendation:** Add row checkboxes and a bulk-action bar (Approve all selected / Deny all selected) for users managing large approval queues. The triage card is good for focused review; the table should support bulk operations.

### Finding 7.3 — Evidence "Show more" uses client-side pagination, not server-side
- **Severity:** Minor
- **Location:** `routes/evidence/index.tsx` lines 30–43
- **Description:** All evidence items are fetched at once and sliced client-side. For the "Meridian Full" dataset (1,200+ entries) this loads all records into memory. The "Show more" button increments a `visibleCount` counter rather than fetching the next page.
- **Recommendation:** Implement server-side pagination using cursor or offset parameters on the `/evidence` endpoint, and update the Evidence page to fetch additional pages on "Show more" press.

---

## Heuristic 8 — Aesthetic and Minimalist Design

### Finding 8.1 — Dashboard duplicates content visible in Inbox
- **Severity:** Minor
- **Location:** `routes/dashboard.tsx` lines 160–197; `routes/inbox.tsx` lines 145–265
- **Description:** Both the Dashboard and the Inbox show "Pending Approvals" lists (up to 5 items each). The Inbox also shows blocked runs and policy violations. The navigation structure places both at the same depth. Users may be confused about which surface is the authoritative triage location.
- **Recommendation:** Differentiate the two surfaces more clearly. The Dashboard could focus on KPIs and trends; the Inbox should own the actionable triage list. Remove the pending-approvals preview from the Dashboard or clearly label it as a summary only.

### Finding 8.2 — System state banner shows "healthy" on every page with no variation
- **Severity:** Minor
- **Location:** `routes/dashboard.tsx` line 127; `routes/inbox.tsx` line 166
- **Description:** `<SystemStateBanner state="healthy" />` is hard-coded with `state="healthy"` on both Dashboard and Inbox. In the current mock, users never see a non-healthy state. The banner takes up vertical space but is always green and never changes, training users to ignore it.
- **Recommendation:** Wire the banner state to real system health data. Hide the banner entirely when state is healthy, only showing it when degraded or critical. This preserves vertical space and ensures the banner is noticed when it matters.

### Finding 8.3 — Agent detail page shows "maskedEndpoint" without explanation
- **Severity:** Minor
- **Location:** `routes/config/agent-detail.tsx` lines 54–57, 88
- **Description:** The endpoint is truncated to 30 characters with `...` appended. The variable is named `maskedEndpoint` internally, suggesting the intent may be security-related masking, but the UI gives no indication of why the value is cut off. A tooltip (`title={agent.endpoint}`) is present but truncated values are confusing.
- **Recommendation:** Either reveal the full endpoint via a "Show full URL" toggle, or add a `Copy endpoint` icon button. If masking is intentional for security, add a brief note: "Endpoint (masked for security)".

---

## Heuristic 9 — Help Users Recognize, Diagnose, and Recover from Errors

### Finding 9.1 — List pages have no error state
- **Severity:** Critical
- **Location:** `routes/runs/index.tsx`, `routes/approvals/index.tsx`, `routes/work-items/index.tsx`, `routes/workforce/index.tsx`, `routes/config/agents.tsx`, `routes/config/adapters.tsx`
- **Description:** None of these list pages handle query error states. If the API returns an error, the `data` will be `undefined`, `items` will fall back to `[]`, and the page will silently render an empty `DataTable` indistinguishable from a genuine empty result set. Users cannot tell whether they have no data or whether something went wrong.
- **Recommendation:** Destructure `isError` from each query hook and render an error state with a human-readable message and a "Retry" button when `isError` is true.

### Finding 9.2 — Approval detail shows generic error message without retry
- **Severity:** Major
- **Location:** `routes/approvals/$approvalId.tsx` lines 50–65
- **Description:** When `isError || !approval` is true, the page shows "The approval request could not be loaded." and a "Back to Approvals" button. There is no "Try again" option and no indication of what went wrong (network error, 404, server error).
- **Recommendation:** Add a "Retry" button that calls `refetch()`. Distinguish 404 errors (show "Approval not found") from network/server errors (show "Could not load — check connection").

### Finding 9.3 — Robots page E-Stop confirmation uses "Confirm" button that immediately sets state; no error feedback if backend call would fail
- **Severity:** Major
- **Location:** `routes/robotics/robots.tsx` lines 133–135; `routes/robotics/safety.tsx` lines 143–147
- **Description:** E-Stop confirmation fires `setGlobalEstopActive(true)` or `setShowConfirm(false)` in local state only. If a real backend call were to fail, the UI would show "E-Stop Active" while the robots were still moving. The current mock has no error path.
- **Recommendation:** When wiring to a real API, wrap the confirm action in a mutation with `onError` handling that reverts the local state and shows a visible error message.

### Finding 9.4 — No feedback after approval decision succeeds or fails
- **Severity:** Major
- **Location:** `routes/approvals/$approvalId.tsx` line 37; `routes/runs/$runId.tsx` line 237
- **Description:** `mutation.mutate({ decision, rationale })` is called but there is no `onSuccess` / `onError` callback shown. Users receive no toast, no in-page message, and no visual change to confirm that their decision was recorded.
- **Recommendation:** Add `onSuccess` to show a toast ("Approval decision recorded") and `onError` to show an error message. The `ApprovalGatePanel` should transition to a read-only "Decision submitted" state after success.

---

## Heuristic 10 — Help and Documentation

### Finding 10.1 — No help or documentation links anywhere in the UI
- **Severity:** Major
- **Location:** All pages; navigation in `routes/__root.tsx`
- **Description:** The cockpit has no help icon, no "?" links, no documentation links, and no contextual tooltips on complex concepts (SoD, execution tier, blast radius). New operators have no in-product path to learn terminology or standard operating procedures.
- **Recommendation:** Add a persistent help icon in the sidebar footer area (next to "ws-demo"), linking to documentation. Add `<Tooltip>` components to domain-specific terms, particularly in the triage card (blast radius, irreversibility, SoD rule IDs).

### Finding 10.2 — Settings page "Demo Dataset" section unexplained
- **Severity:** Minor
- **Location:** `routes/config/settings.tsx` lines 101–134
- **Description:** The "Demo Dataset" card appears in the production Settings page with no indication that it is a development/demo-only feature. Users in a real deployment will see this and be confused about what "Meridian Cold Chain" datasets are.
- **Recommendation:** Guard the Demo Dataset card behind a `VITE_DEMO_MODE` environment flag, or add a clear label: "Developer preview — not visible in production deployments."

### Finding 10.3 — Empty state descriptions are too generic
- **Severity:** Minor
- **Location:** `components/cockpit/empty-state.tsx` usages: `routes/config/agent-detail.tsx` line 42, `routes/workforce/$memberId.tsx` line 53
- **Description:** Empty state messages like "The agent you are looking for does not exist or has been removed" give no guidance on what to do next (e.g. "Return to Agents list to find the correct agent, or check the URL.").
- **Recommendation:** Add a concrete suggested action to each empty state: "Return to [list page]" as a link, or "Contact your administrator if you believe this is an error."

---

## Summary Table

| # | Heuristic | Severity | Finding |
|---|-----------|----------|---------|
| 1.1 | System Status Visibility | Major | Generic loading text on Explore pages |
| 1.2 | System Status Visibility | Minor | DataTable skeleton always 5 rows |
| 1.3 | System Status Visibility | Minor | EvidenceTimeline no internal empty state |
| 1.4 | System Status Visibility | Minor | No last-refreshed timestamp on live Event stream |
| 2.1 | Real World Match | Minor | "Runs" and filter tier labels are jargon |
| 2.2 | Real World Match | Minor | "SoD" unexplained |
| 2.3 | Real World Match | Minor | Triage keyboard hint labels unclear |
| 3.1 | User Control & Freedom | Critical | No undo path after E-Stop confirm |
| 3.2 | User Control & Freedom | Major | Mission Cancel in table implies immediate action |
| 3.3 | User Control & Freedom | Major | No way to see/recover skipped triage items |
| 3.4 | User Control & Freedom | Minor | Workforce queues not interactive, no explanation |
| 4.1 | Consistency & Standards | Major | Two empty-state patterns inconsistently applied |
| 4.2 | Consistency & Standards | Major | Three loading patterns in one codebase |
| 4.3 | Consistency & Standards | Minor | Work-items owner filter uses raw user IDs |
| 4.4 | Consistency & Standards | Minor | "New Run" only on Dashboard, not on Runs page |
| 5.1 | Error Prevention | Major | Deny rationale constraint not surfaced early |
| 5.2 | Error Prevention | Major | E-Stop dialog says "irreversible" but undo exists |
| 5.3 | Error Prevention | Minor | No SLA urgency cues on work-item detail |
| 6.1 | Recognition Over Recall | Major | Truncated IDs with no tooltip or copy affordance |
| 6.2 | Recognition Over Recall | Major | Filter state resets on navigation |
| 6.3 | Recognition Over Recall | Minor | Capability tags abbreviated inconsistently |
| 7.1 | Flexibility & Efficiency | Major | DataTable rows not keyboard-navigable |
| 7.2 | Flexibility & Efficiency | Minor | No bulk action for approval list view |
| 7.3 | Flexibility & Efficiency | Minor | Evidence uses client-side pagination for large datasets |
| 8.1 | Aesthetic & Minimalist | Minor | Dashboard and Inbox duplicate pending approvals |
| 8.2 | Aesthetic & Minimalist | Minor | System state banner always "healthy", always visible |
| 8.3 | Aesthetic & Minimalist | Minor | Agent endpoint masked without explanation |
| 9.1 | Error Recognition & Recovery | Critical | List pages silently show empty on API error |
| 9.2 | Error Recognition & Recovery | Major | Approval detail has no retry on error |
| 9.3 | Error Recognition & Recovery | Major | E-Stop local state not tied to backend error handling |
| 9.4 | Error Recognition & Recovery | Major | No feedback toast after approval decision |
| 10.1 | Help & Documentation | Major | No help links or contextual documentation anywhere |
| 10.2 | Help & Documentation | Minor | Demo Dataset card appears in production settings |
| 10.3 | Help & Documentation | Minor | Empty state descriptions give no actionable next step |

**Totals:** 2 Critical, 14 Major, 18 Minor

---

## Priority Recommendations

1. **Immediate (Critical):** Add error states to all list-page query hooks (Finding 9.1). Add undo/recovery affordance for E-Stop (Finding 3.1).
2. **High (Major — user-facing workflow):** Add success/error feedback to approval decisions (9.4). Persist filter state in URL params (6.2). Add keyboard accessibility to DataTable rows (7.1).
3. **Medium (Major — consistency):** Standardise loading and empty-state patterns (4.1, 4.2). Surface deny rationale requirement early (5.1). Add retry button to approval detail error state (9.2).
4. **Low (Minor):** Humanise jargon labels (2.1, 2.2). Add tooltips for truncated IDs (6.1). Guard Demo Dataset behind a feature flag (10.2).
