# Cockpit Prototype: Heuristic Evaluation Report — Robotics Section

**Date**: 2026-02-21
**Evaluators**: UX/UI Design Expert, HCI Specialist, Usability Engineer
**Framework**: Jakob Nielsen's 10 Usability Heuristics + additional HCI criteria
**Artifact**: Robotics cockpit prototype — 6 routes, map-centric, fleet-management oriented
**Key components**: `map-view.tsx`, `robot-list-panel.tsx`, `robot-detail-panel.tsx`, `alert-triage-panel.tsx`, `playback-controls.tsx`, `layer-toggles.tsx`

---

## Executive Summary

The robotics section of the cockpit provides a solid functional foundation: fleet overview cards, a Leaflet-based operations map, mission dispatch with confirmation dialogs, a safety page with global E-Stop governance, and gateway connectivity monitoring. The code demonstrates good use of status badges with icon+text redundancy, resizable panels for the map view, and confirmation flows for destructive actions. However, several significant usability issues were identified — most notably around visibility of system status (non-functional playback controls, missing loading feedback), user control (no undo for E-Stop, keyboard gaps on the map), and help/documentation (no hero prompts, no onboarding, no legend). The map page deviates from the established PageHeader pattern, and the E-Stop state is stored in local component state, creating a dangerous inconsistency on navigation.

**Overall score**: 5.7 / 10 (Below average — functional prototype with critical UX gaps requiring attention before user testing)

### Severity Scale

- **0**: Not a usability problem
- **1**: Cosmetic only — fix if time allows
- **2**: Minor — low priority
- **3**: Major — important to fix, high priority
- **4**: Catastrophic — must fix before release

---

## H1: Visibility of System Status

**Score: 6/10**

### Strengths

- Status badges on the Robots page use icon+text+color triple-coding (`RobotStatusBadge` in `apps/cockpit/src/routes/robotics/robots.tsx` line 24–58) — Online/Degraded/E-Stopped/Offline each get a distinct Lucide icon, semantic colour class, and text label
- The Operations Map header shows a live count of robots and alerts (`apps/cockpit/src/routes/robotics/map.tsx` line 53–55): `{locations.length} robots · {alerts.length} alerts`
- Robot list panel displays battery percentage with conditional red colouring when below 20% (`apps/cockpit/src/components/cockpit/operations-map/robot-list-panel.tsx` line 97)
- Mission stats cards (Active, Pending, Done Today, Failed) provide at-a-glance workload on the Missions page (`apps/cockpit/src/routes/robotics/missions.tsx` line 377–389)
- Safety page uses an `aria-live="polite"` status banner for the global E-Stop state (`apps/cockpit/src/routes/robotics/safety.tsx` line 97–98)

### Issues

| #   | Issue                                                                                                                                                                                                                                                                                                                                                                                               | Screen(s)                | Severity | Recommendation                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | **No loading feedback on actions**. The "Send E-Stop" button in the robot detail sheet (`robots.tsx` line 219), mission Cancel/Pre-empt buttons (`missions.tsx` line 193–209), and Retry Mission button (`missions.tsx` line 238–249) give no spinner or disabled state during async operations. The E-Stop confirm button calls `setShowConfirm(false)` immediately without indicating processing. | Robots, Missions, Safety | **3**    | Add a spinner or "Processing..." state on action buttons. Disable button and show `<Loader2 className="animate-spin" />` during the async call. |
| 1.2 | **Playback controls are non-functional with no disclosure**. `PlaybackControls` (`apps/cockpit/src/components/cockpit/operations-map/playback-controls.tsx`) renders Live/Replay mode toggles and a timeline scrubber, but state is entirely local — `position` and `speed` drive no actual map behaviour. There is no "Coming soon" label or disabled state to signal this.                        | Map                      | **3**    | Either wire playback to actual data replay or add a visible "Coming soon" badge. Do not render interactive controls that silently do nothing.   |
| 1.3 | **No relative timestamps on robot heartbeats**. The robot detail panel (`robot-detail-panel.tsx` line 114–116) shows `new Date(robot.updatedAtIso).toLocaleString()` but no "X seconds ago" relative time. For fleet operations, recency is critical.                                                                                                                                               | Map                      | **2**    | Add relative time alongside the absolute timestamp using `formatDistanceToNow` from `date-fns`.                                                 |
| 1.4 | **Mission table dispatched time shows only HH:mm, not date**. Column renderer (`missions.tsx` line 319–320) uses `format(new Date(row.dispatchedAtIso), 'HH:mm')` — missions from previous days lose context.                                                                                                                                                                                       | Missions                 | **2**    | Use conditional formatting: show "HH:mm" for today, "MMM d HH:mm" for older missions.                                                           |
| 1.5 | **Gateway heartbeat shows no relative staleness indicator**. The Gateways table (`gateways.tsx` line 68) shows absolute time `MMM d, yyyy HH:mm` with no visual cue for stale heartbeats (e.g., >5 minutes old should be flagged).                                                                                                                                                                  | Gateways                 | **2**    | Add conditional colouring or a warning icon when heartbeat age exceeds a threshold.                                                             |

---

## H2: Match Between System and the Real World

**Score: 7/10**

### Strengths

- Robot class filters use standard industry abbreviations (AMR, AGV, UAV, PLC) that robotics operators will recognize (`apps/cockpit/src/routes/robotics/robots.tsx` line 15–22)
- Mission action types (`navigate_to`, `pick`, `place`, `dock`) in `apps/cockpit/src/types/robotics.ts` line 21 map directly to warehouse robotics vocabulary
- Safety enforcement modes are labelled clearly: "Block", "Warn", "Log" — plain operational language (`safety.tsx` line 28–35)
- The E-Stop icon uses `ShieldAlert` and `OctagonX` — recognizable physical E-Stop metaphors

### Issues

| #   | Issue                                                                                                                                                                                                                                                                                                                                                                                  | Screen(s)      | Severity | Recommendation                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | **"Halos" is jargon**. The layer toggle (`apps/cockpit/src/components/cockpit/operations-map/layer-toggles.tsx` line 19) labels a map layer "Halos" with a `CircleDot` icon. This refers to uncertainty radius circles drawn around degraded/E-Stopped robots (`map-view.tsx` line 127–142), but "Halos" is not a standard term. Operators may not understand what toggling this does. | Map            | **3**    | Rename to "Uncertainty Radius" or "Status Zones" with a tooltip: "Shows approximate position uncertainty for degraded or stopped robots."      |
| 2.2 | **Mission IDs are opaque without context**. The mission detail sheet title shows only `mission.missionId` (`missions.tsx` line 112–113) — e.g., "MSN-0042" — without the goal or robot name. Users must scan to the Details section to understand what mission they are looking at.                                                                                                    | Missions       | **2**    | Show the goal or robot name in the sheet title: "MSN-0042 — Navigate to Dock B" or "MSN-0042 (robot-alpha-01)".                                |
| 2.3 | **"SPIFFE SVID" in robot detail sheet is developer jargon**. The robot detail sheet (`robots.tsx` line 160–161) displays `robot.spiffeSvid` under an "Identity" section. Most operators will not know what a SPIFFE Secure Verifiable Identity Document is.                                                                                                                            | Robots         | **2**    | Rename the label to "Service Identity" with a tooltip explaining: "SPIFFE-based identity used for mutual TLS authentication with the gateway." |
| 2.4 | **"OpenClaw" in Gateways index card description**. The robotics index page (`apps/cockpit/src/routes/robotics/index.tsx` line 35) describes gateways as "OpenClaw gateway connectivity" — this product name may not be meaningful to all users.                                                                                                                                        | Robotics Index | **1**    | If "OpenClaw" is an internal code name, use "Robotics gateway" instead, or add a brief explanatory subtitle.                                   |
| 2.5 | **"Test" button on robot card is cryptic**. `robots.tsx` line 108–109 renders a "Test ↺" button with no tooltip or explanation of what test is performed.                                                                                                                                                                                                                              | Robots         | **2**    | Rename to "Ping" or "Health Check" with a tooltip: "Send a heartbeat request to verify the robot is responsive."                               |

---

## H3: User Control and Freedom

**Score: 5/10**

### Strengths

- Robot detail sheet on the Robots page has a confirmation step for E-Stop with Cancel option (`robots.tsx` line 231–255)
- Mission detail sheet has a "Go back" button in the confirmation flow (`missions.tsx` line 204–208)
- The robot list panel allows deselection by clicking the same robot again (`robot-list-panel.tsx` line 70)
- Resizable panels on the map page let users adjust the split between map and list (`map.tsx` line 60–95)

### Issues

| #   | Issue                                                                                                                                                                                                                                                                                                                                            | Screen(s) | Severity | Recommendation                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | **No undo or recovery for global E-Stop**. The safety page E-Stop confirmation dialog (`safety.tsx` line 270–303) warns the action is "irreversible until manually cleared" but the confirm button fires immediately with no cooling-off period. For an action that halts ALL robots, a 5-second countdown or typed-confirmation would be safer. | Safety    | **4**    | Add a typed-confirmation requirement (e.g., type "STOP ALL") or a 5-second countdown before the Confirm button becomes active.                |
| 3.2 | **No "Fit All" or "Reset View" button on the map**. Once a user flies to a selected robot (`map-view.tsx` line 53–74 `FlyToSelected`), there is no way to reset the map to show all robots at once. The user must manually zoom and pan.                                                                                                         | Map       | **3**    | Add a "Fit All" button in the map overlay that calls `map.fitBounds()` with the extent of all robot positions.                                |
| 3.3 | **No keyboard method to deselect a robot on the map**. Selection is click-only (`map-view.tsx` line 167–169). Pressing Escape does not deselect. The detail panel close button (`robot-detail-panel.tsx` line 41) requires a mouse click.                                                                                                        | Map       | **3**    | Add an `onKeyDown` handler for Escape that calls `onSelectRobot(null)`. Ensure the close button is focusable and responds to Enter/Space.     |
| 3.4 | **E-Stop state is local React state — resets on navigation**. `globalEstopActive` is `useState(false)` in `SafetyPage` (`safety.tsx` line 71). If a user activates the global E-Stop and then navigates away and back, the UI reverts to "System NOMINAL". This is dangerous misinformation.                                                     | Safety    | **4**    | Move E-Stop state to a server-driven query or a global store (e.g., `useUIStore`). The E-Stop status banner must reflect actual system state. |
| 3.5 | **No bulk selection or multi-robot actions on the Robots page**. Each robot must be acted on individually through its detail sheet. If multiple robots are degraded, the operator must open each one separately.                                                                                                                                 | Robots    | **2**    | Add checkbox selection to robot cards with a bulk action bar: "3 selected: Send E-Stop All / Reassign Missions".                              |

---

## H4: Consistency and Standards

**Score: 6/10**

### Strengths

- Robots, Missions, and Safety pages all use the shared `PageHeader` component (`apps/cockpit/src/components/cockpit/page-header.tsx`) with consistent title + description pattern
- Status badge styling is consistent between the robot list panel and the robot detail panel (same `STATUS_BADGE_CLASS` mapping in both files)
- Mission confirmation dialogs follow the same destructive-action pattern used in the Robots detail sheet (red border, explanation text, Confirm/Cancel buttons)
- Filter pills on the Robots page use the same rounded-full styling as the cockpit-wide filter chip pattern

### Issues

| #   | Issue                                                                                                                                                                                                                                                                                                  | Screen(s)           | Severity | Recommendation                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | **Map page uses a custom header instead of PageHeader**. The Operations Map route (`map.tsx` line 48–56) renders its own `<div>` with an `<h1>` and inline stats, bypassing the shared `PageHeader` component that every other robotics page uses. This breaks visual consistency.                     | Map                 | **3**    | Refactor the map header to use `PageHeader` with a custom `action` slot for the robot/alert count, or extend `PageHeader` to support inline stats. |
| 4.2 | **No breadcrumbs on any robotics page**. The `PageHeader` component supports a `breadcrumb` prop, but none of the robotics routes pass it. Users navigating from `/robotics` to `/robotics/robots` lose their position context — unlike other cockpit sections that use breadcrumbs on detail screens. | All robotics routes | **2**    | Add breadcrumbs: `Robotics > Robots`, `Robotics > Map`, etc. Use `PageHeader`'s existing `breadcrumb` prop.                                        |
| 4.3 | **Duplicate `STATUS_ICON` and `STATUS_BADGE_CLASS` definitions**. Both `robot-list-panel.tsx` (lines 16–28) and `robot-detail-panel.tsx` (lines 17–29) define identical icon and class maps independently. This invites drift.                                                                         | Map (components)    | **1**    | Extract to a shared `robot-status-utils.ts` constants file under `operations-map/`.                                                                |
| 4.4 | **Inconsistent sheet width across robotics screens**. Robot detail sheet uses `w-[420px] sm:w-[480px]` (`robots.tsx` line 145), mission detail sheet uses the same (`missions.tsx` line 108), but gateway detail sheet uses default sheet width (`gateways.tsx` line 90). Should be uniform.           | Robots vs Gateways  | **1**    | Standardize sheet widths across all robotics detail panels.                                                                                        |
| 4.5 | **Robot cards on the Robots page show ID first, name second** (`robots.tsx` line 80–81), but robot list items on the Map page show name first, ID second (`robot-list-panel.tsx` line 80–81). Inconsistent hierarchy creates confusion about which is the primary identifier.                          | Robots vs Map       | **2**    | Choose one convention — name as primary, ID as secondary — and apply consistently.                                                                 |

---

## H5: Error Prevention

**Score: 6/10**

### Strengths

- Mission cancel and pre-empt actions require a two-step confirmation flow in the detail sheet (`missions.tsx` line 183–209)
- Robot E-Stop in the detail sheet has an inline confirm step (`robots.tsx` line 212–257)
- Global E-Stop has a modal confirmation dialog (`safety.tsx` line 270–303)
- Clear E-Stop requires a rationale text field that must be non-empty (`safety.tsx` line 332–333)

### Issues

| #   | Issue                                                                                                                                                                                                                                                                                                                                                                | Screen(s) | Severity | Recommendation                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 5.1 | **Global E-Stop confirmation does not show the count of affected robots**. The dialog (`safety.tsx` line 278–279) says "ALL robots will be immediately halted" but does not state how many. An operator managing 200 robots needs to know the blast radius before confirming.                                                                                        | Safety    | **3**    | Add to the dialog: "This will immediately halt **{N} robots** across {M} sites." Pull the count from the constraints data or robots query.       |
| 5.2 | **E-Stop state is local component state (`useState(false)`) that resets on navigation**. A user could activate E-Stop, navigate to Missions, and return to Safety seeing "System NOMINAL". The banner at `safety.tsx` line 96–128 is driven entirely by `globalEstopActive` local state.                                                                             | Safety    | **4**    | Source the E-Stop state from the backend via a query hook. Display a persistent banner across all robotics routes when E-Stop is active.         |
| 5.3 | **Mission Retry button on the table has no confirmation**. The inline Retry button in the missions table (`missions.tsx` line 341–354) calls `handleRetry(row.missionId)` directly on click with no guard — unlike Cancel and Pre-empt which open the detail sheet for confirmation.                                                                                 | Missions  | **3**    | Route the Retry action through the detail sheet confirmation flow, or add a quick confirm popover.                                               |
| 5.4 | **"Edit" button on safety constraints table is a no-op**. The Edit button (`safety.tsx` line 159–166) renders but has no `onClick` handler — clicking does nothing with no feedback.                                                                                                                                                                                 | Safety    | **2**    | Either wire the button to an edit form or disable it with a tooltip: "Editing constraints is not yet available."                                 |
| 5.5 | **No guard preventing E-Stop on an already-E-Stopped robot**. The per-robot E-Stop button in the detail sheet (`robots.tsx` line 217–219) disables when the E-Stopped flag is true, which is correct. But the confirm action (`robots.tsx` line 243) calls `setShowConfirm(false)` without actually sending the command — both Confirm and Cancel do the same thing. | Robots    | **3**    | Wire the Confirm button to an actual mutation. Currently both buttons call `setShowConfirm(false)` identically, making the confirm flow a no-op. |

---

## H6: Recognition Rather Than Recall

**Score: 5/10**

### Strengths

- Robot list panel items show name, ID, battery, coordinates, and speed all inline — no need to open a detail view for basic information (`robot-list-panel.tsx` line 78–111)
- Mission status badges use icon+text redundancy (`missions.tsx` line 22–64), reducing reliance on colour alone
- Safety page has section headers ("Per-Site Constraints", "Approval Policy Thresholds", "E-Stop Audit Log") that clearly label each table's purpose

### Issues

| #   | Issue                                                                                                                                                                                                                                                                                                                                     | Screen(s)      | Severity | Recommendation                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 6.1 | **Robot markers on the map are tiny undifferentiated dots**. The `robotIcon` function (`map-view.tsx` line 36–51) renders 12px coloured circles (18px when selected). At zoom levels showing the full warehouse, these are nearly invisible. There is no shape or icon differentiation between robot classes (AMR vs UAV vs Manipulator). | Map            | **3**    | Use distinct marker shapes or icons per robot class. Increase default size to at least 16px. Add a pulsing animation for robots in motion. |
| 6.2 | **No map legend**. The map uses green/yellow/red/grey dots for status and dashed polygons for geofences, but there is no legend explaining the colour or shape mappings. Users must recall the colour codes.                                                                                                                              | Map            | **3**    | Add a collapsible legend panel showing: Online (green), Degraded (yellow), E-Stopped (red), Offline (grey), and geofence polygon colours.  |
| 6.3 | **Robot IDs not paired with names in mission and alert contexts**. The alert triage panel (`alert-triage-panel.tsx` line 44–45) shows `alert.robotId` but not the robot name. The missions table (`missions.tsx` line 299–301) shows `row.robotId` in monospace with no name. Users must recall which ID maps to which physical robot.    | Map, Missions  | **3**    | Always pair robot ID with name. In the missions table, show "robot-alpha-01 (Forklift A)" or at minimum add a tooltip.                     |
| 6.4 | **Layer toggles have no description of what each layer shows**. The `LayerToggles` component (`layer-toggles.tsx` line 16–19) shows "Geofences", "Trails", "Halos" with icons but no explanation of what enabling each layer does.                                                                                                        | Map            | **2**    | Add tooltips on each toggle button: "Geofences: Show restricted zone boundaries", "Trails: Show recent movement paths", etc.               |
| 6.5 | **Robotics index cards have no counts or health indicators**. The index page (`apps/cockpit/src/routes/robotics/index.tsx` line 8–39) shows static descriptions but no live data (e.g., "4 robots online", "2 active missions"). Users cannot assess urgency without navigating into each section.                                        | Robotics Index | **2**    | Add live summary counts to each card: "12 robots (2 degraded)", "5 active missions", "1 gateway offline".                                  |

---

## H7: Flexibility and Efficiency of Use

**Score: 6/10**

### Strengths

- Robot list panel has status filter pills (All/Online/Degraded/E-Stopped/Offline) for quick filtering (`robot-list-panel.tsx` line 8–14)
- Robots page has class filters (All/AMR/AGV/Manipulator/UAV/PLC) (`robots.tsx` line 15–22)
- Resizable panels on the map page allow users to customize the map-to-list ratio (`map.tsx` line 60–95)
- Mission table uses the shared `DataTable` component with pagination (`missions.tsx` line 390–397)

### Issues

| #   | Issue                                                                                                                                                                                                                                                                              | Screen(s)                  | Severity | Recommendation                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 7.1 | **No search in the robot list**. Neither the Robots page nor the Robot List Panel on the map has a text search input. With a large fleet, operators cannot quickly find a specific robot by name or ID.                                                                            | Robots, Map                | **3**    | Add a search input at the top of the robot list that filters by name, ID, or mission ID.                                         |
| 7.2 | **No column sorting on any table**. The missions table, safety constraints table, approval thresholds table, gateway table, and E-Stop audit log are all unsorted or use a fixed order with no user-controlled sorting.                                                            | Missions, Safety, Gateways | **3**    | Enable clickable column headers for sorting on all `DataTable` and manual `<table>` instances.                                   |
| 7.3 | **No keyboard shortcuts for map operations**. The map has no keyboard bindings for common actions: zoom in/out, fit all, cycle through robots, toggle layers. All map interaction requires mouse input.                                                                            | Map                        | **3**    | Add keyboard shortcuts: `+`/`-` for zoom, `F` for fit-all, `[`/`]` to cycle robots, `1`/`2`/`3` to toggle layers.                |
| 7.4 | **No status filter on the missions table**. Unlike the Robots page which has status filter pills, the Missions page has no way to filter by status (Pending/Executing/Completed/Failed/Cancelled). Users must scan the full table.                                                 | Missions                   | **2**    | Add status filter pills matching the pattern used on the Robots page.                                                            |
| 7.5 | **No direct navigation between related entities**. Robot detail sheet shows a mission ID (`robots.tsx` line 200–203) but it is not a link to the mission. Alert triage panel shows a robot ID but clicking only selects on the map — does not link to the Robots page detail view. | Robots, Map                | **2**    | Make mission IDs clickable links to `/robotics/missions` filtered by that mission. Make robot IDs cross-linkable between routes. |

---

## H8: Aesthetic and Minimalist Design

**Score: 7/10**

### Strengths

- Clean card-based layout on the Robots page with consistent spacing and grid responsiveness (`robots.tsx` line 337)
- Map page uses a full-height layout with clear spatial hierarchy (map dominant, list secondary)
- Robotics index page is minimal and scannable — icon + title + description per card
- Safety page organizes complex information into clearly delineated sections with headers

### Issues

| #   | Issue                                                                                                                                                                                                                                                                                                                       | Screen(s) | Severity | Recommendation                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 8.1 | **Map overlays clash at bottom**. The `AlertTriagePanel` is positioned `absolute bottom-3 left-3` (`alert-triage-panel.tsx` line 21) and `PlaybackControls` is positioned `absolute bottom-3 left-1/2 -translate-x-1/2` (`playback-controls.tsx` line 17). On narrow viewports or with many alerts, these visually overlap. | Map       | **3**    | Stack the alert panel above the playback bar, or move playback controls to the map header. Use a fixed bottom bar layout with defined zones. |
| 8.2 | **Robot detail panel on the map is cramped**. `RobotDetailPanel` (`robot-detail-panel.tsx`) uses a 2-column grid with 10px uppercase labels and tight spacing. When shown below the robot list in a narrow side panel, content is squeezed.                                                                                 | Map       | **2**    | Consider a slide-out sheet (matching the Robots page pattern) instead of an inline panel below the list.                                     |
| 8.3 | **Safety page is long-scrolling with no section navigation**. The Safety page (`safety.tsx`) has 4 sections (banner, constraints, thresholds, audit log) stacked vertically. On data-heavy instances, users must scroll extensively.                                                                                        | Safety    | **2**    | Add anchor links or a tab-based layout to allow direct navigation to Constraints, Thresholds, or Audit Log.                                  |
| 8.4 | **Robots page stats cards repeat information available in the filter pills**. The stat cards (Total, Online, Degraded, E-Stopped) at `robots.tsx` line 290–302 mirror the status filters below them. Users see the breakdown twice.                                                                                         | Robots    | **1**    | Consider making the stat cards interactive (clicking "Degraded: 2" activates the Degraded filter) to merge the two elements.                 |

---

## H9: Help Users Recognize, Diagnose, and Recover from Errors

**Score: 5/10**

### Strengths

- E-Stop confirm dialog on the Safety page explains consequences: "ALL robots will be immediately halted. This action is irreversible until manually cleared and will be logged in the audit trail." (`safety.tsx` line 278–280)
- Per-robot E-Stop inline confirm explains: "This will immediately halt the robot. Action is logged." (`robots.tsx` line 236–237)
- Mission cancel/pre-empt confirmation states: "This action will be logged in the evidence chain." (`missions.tsx` line 189–190)
- Toast notifications confirm successful mutations (`missions.tsx` line 275–286)

### Issues

| #   | Issue                                                                                                                                                                                                                                                                                                                                                                                               | Screen(s)   | Severity | Recommendation                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9.1 | **No guidance after global E-Stop activation**. After confirming E-Stop, the UI shows a red banner "GLOBAL E-STOP ACTIVE — All robots halted" with a "Clear E-Stop (admin)" button (`safety.tsx` line 106–117). But there is no checklist, no next-steps guidance, no link to the audit log section below. Operators need to know: check robot positions, notify supervisors, file incident report. | Safety      | **3**    | Expand the E-Stop active banner with actionable steps: "1. Verify robot positions on the Map 2. Review the Audit Log below 3. Contact site lead."                         |
| 9.2 | **No recovery path for degraded robots**. The robot list shows "Degraded" status (`robot-list-panel.tsx` line 12) but there is no indication of WHY the robot is degraded or WHAT the operator should do. The robot detail panel (`robot-detail-panel.tsx`) shows status but offers no diagnostics or remediation actions.                                                                          | Map, Robots | **3**    | Add a "Diagnostics" section to the robot detail view showing the reason for degradation and suggested recovery actions (e.g., "Battery low — route to charging station"). |
| 9.3 | **Failed mission shows Retry button but no failure reason**. The missions table shows a "Failed" badge and a Retry button (`missions.tsx` line 341–354), and the detail sheet shows "Failed" status, but neither displays why the mission failed. Operators must guess or check external logs.                                                                                                      | Missions    | **3**    | Add a `failureReason` field to `MissionSummary` and display it in the detail sheet and as a tooltip on the Failed badge.                                                  |
| 9.4 | **E-Stop catch block silently swallows errors**. The global E-Stop fetch call at `safety.tsx` line 289–293 uses `.catch(() => null)` — if the API call fails, the UI still sets `globalEstopActive = true`, showing a false positive. Same pattern on Clear E-Stop (`safety.tsx` line 335–339).                                                                                                     | Safety      | **4**    | Handle the error explicitly: show a toast error "Failed to activate E-Stop — please retry or contact support." Do not update local state on failure.                      |
| 9.5 | **No empty state guidance on the E-Stop audit log**. When the log is empty (`safety.tsx` line 219), it shows italic text "No E-Stop events recorded." with no context. New users do not know what would appear here.                                                                                                                                                                                | Safety      | **1**    | Expand to: "No E-Stop events recorded. E-Stop activations and clearances will appear here with timestamp, actor, and rationale."                                          |

---

## H10: Help and Documentation

**Score: 4/10**

### Strengths

- The robotics index page card descriptions (`apps/cockpit/src/routes/robotics/index.tsx` line 11–38) provide a brief orientation for each sub-section
- Safety page description ("Global safety controls, constraints, and audit trail") gives context
- `aria-label` attributes are present on key interactive elements (E-Stop buttons, filter groups)

### Issues

| #    | Issue                                                                                                                                                                                                                                                                                                       | Screen(s)           | Severity | Recommendation                                                                                                                                                    |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10.1 | **No hero prompts on any robotics screen**. The main cockpit uses hero prompts on every screen for inline contextual help. The robotics section has zero hero prompts — no screen self-describes its purpose or guides the user. This is a major departure from the established cockpit pattern.            | All robotics routes | **3**    | Add hero prompts to each screen following the main cockpit pattern. E.g., Map: "Track your fleet in real time. Select a robot to see details and send commands."  |
| 10.2 | **No explanation of the robot-workflow relationship**. The robotics section is architecturally separate from workflows, but missions can be dispatched from workflow actions via the RoboticsActuation port. There is no in-UI explanation of how missions relate to workflow runs or governance approvals. | Missions, Robots    | **3**    | Add an info callout on the Missions page: "Missions can be dispatched manually or by workflow actions. All missions follow the same approval and audit policies." |
| 10.3 | **No tooltips on badges or technical terms**. Enforcement badges ("Block", "Warn", "Log"), tier badges ("HumanApprove", "Auto"), robot class badges ("AMR", "AGV") — none have tooltips explaining what they mean.                                                                                          | Safety, Robots      | **3**    | Add tooltips on all badges. E.g., HumanApprove: "Requires human approval before execution." Block: "Violating robots are automatically halted."                   |
| 10.4 | **No onboarding for the map interface**. The map renders with layer toggles, alert panel, and playback controls visible but unexplained. First-time users face a map with coloured dots and no guidance on how to interact.                                                                                 | Map                 | **2**    | Add a first-visit overlay or tooltip tour: "Click a robot to see details. Use layer toggles to show geofences and trails. Alerts appear in the bottom-left."      |
| 10.5 | **No documentation link or help button on any robotics screen**. Unlike the main cockpit which has a `?` keyboard shortcut and command palette, the robotics section provides no path to documentation, glossary, or help.                                                                                  | All robotics routes | **2**    | Ensure the `?` shortcut and Ctrl+K palette are functional within robotics routes. Add a help link in the PageHeader action slot.                                  |

---

## Additional HCI Criteria

### Accessibility (WCAG-adjacent)

| #   | Issue                                                                                                                                                                                                                                                                                   | Severity | Recommendation                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| A.1 | **Map markers rely entirely on colour for status**. The `robotIcon` function (`map-view.tsx` line 36–51) renders solid-colour circles with no shape, pattern, or icon differentiation. Colourblind users cannot distinguish Online (green) from Degraded (yellow) or Offline (grey).    | **3**    | Use distinct shapes per status: circle for Online, triangle for Degraded, octagon for E-Stopped, X for Offline. Or add SVG icons inside markers. |
| A.2 | **Playback speed buttons are 10px text**. The speed selector buttons (`playback-controls.tsx` line 63) use `text-[10px]` — below WCAG minimum for touch targets and readability.                                                                                                        | **2**    | Increase to at least 12px text with a minimum 24x24px tap target per WCAG 2.5.8.                                                                 |
| A.3 | **Alert triage panel items have no ARIA role or keyboard navigation**. Alerts are rendered as `<button>` elements (`alert-triage-panel.tsx` line 29) but the panel has no `role="list"` or `aria-label`, and there is no keyboard mechanism to navigate between alerts without a mouse. | **3**    | Add `role="list"` on the container, `role="listitem"` on each alert, and arrow-key navigation. Add an `aria-label` to the panel.                 |
| A.4 | **Layer toggle buttons lack explicit `aria-pressed` state**. The `LayerToggles` component (`layer-toggles.tsx` line 26–37) toggles between `variant="default"` and `variant="ghost"` but does not set `aria-pressed` to convey toggle state to screen readers.                          | **2**    | Add `aria-pressed={layers[key]}` to each toggle button.                                                                                          |

### Cognitive Load

| #   | Issue                                                                                                                                                                                                                                                                                                                  | Severity | Recommendation                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C.1 | **Operations Map simultaneously presents: robot markers, geofence polygons, uncertainty halos, trail polylines, an alert triage panel, playback controls, layer toggles, a robot list, and a robot detail panel**. All are visible at once with no progressive disclosure. New users face high initial cognitive load. | **3**    | Default to a simpler initial state: only robot markers and geofences visible. Show alerts and playback only when relevant (alerts > 0, user enters replay mode). Let users progressively enable layers. |
| C.2 | **Safety page requires users to understand three separate governance concepts simultaneously**: enforcement modes (block/warn/log), execution tiers (Auto/HumanApprove), and E-Stop mechanics. These are presented as three adjacent tables with no connecting narrative.                                              | **2**    | Add brief introductory paragraphs before each section explaining its purpose and relationship to the others. Or add a "How Safety Works" expandable guide at the top.                                   |

### Information Architecture

| #    | Issue                                                                                                                                                                                                                                                                                                                                                                    | Severity | Recommendation                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| IA.1 | **Robotics section is architecturally separate from Workflows in the sidebar, but shares the same governance model**. Users managing robot missions dispatched by workflow actions must switch between the Workflows and Robotics sections with no cross-links. The relationship between a Workflow Run's RoboticsActuation action and a Mission is invisible in the UI. | **3**    | Add cross-links: in the Workflow Run detail, link to the dispatched Mission. In the Mission detail, link back to the originating Workflow Run if applicable. |
| IA.2 | **Gateway page is shallow**. The gateway detail sheet (`gateways.tsx` line 89–120) shows only Status, Region, Connected Robots, and Last Heartbeat — no robot list, no connection history, no diagnostics. It provides little value over the table row.                                                                                                                  | **2**    | Expand the gateway detail to show: list of connected robots, connection uptime chart, recent errors, and certificate expiry status.                          |

---

## Part C: Robot-Workflow Architectural Relationship

The robotics section and the workflows section of the cockpit are **architecturally separate domains** that connect through a well-defined port boundary:

1. **RoboticsActuation port family**: A Workflow can include a `RoboticsActuation` action in its execution plan. This action type dispatches a Mission to a robot via `MissionPort`. The workflow orchestrator does not directly control the robot — it delegates through the port abstraction.

2. **Mission-to-ActionExecution evidence**: Each Mission tracks its own `ActionExecution` evidence, which is tied back to the governance chain. When a mission completes (or fails), the evidence record links the outcome to the originating Workflow Run, preserving the full audit trail.

3. **Shared governance model**: Both workflows and robotics share the same governance primitives — policies, approval rules, execution tiers (`Auto`, `HumanApprove`, `Assisted`, `ManualOnly`), and audit logging. The `ApprovalThreshold` table on the Safety page (`apps/cockpit/src/routes/robotics/safety.tsx` line 179–211) mirrors the tier model used in workflow approval gates.

4. **Sidebar separation**: The robotics sidebar section is intentionally separate from the workflows section in the cockpit navigation. This reflects the domain boundary: robotics operators may not be workflow designers, and vice versa. However, this separation currently creates a discoverability gap — there are no cross-links between a Workflow Run that dispatched a Mission and the Mission's detail view.

5. **Implication for UX**: The lack of in-UI connection between these domains means that an operator viewing a failed Mission has no way to trace back to the Workflow Run that initiated it, and a workflow approver has no visibility into the physical-world status of a robot executing their approved action. Bridging this gap with cross-links and shared evidence views is a high-priority UX improvement.

---

## Priority Summary: Top 10 Fixes

Ranked by impact (severity x frequency across screens):

| Rank | Issue                                                                                                  | Heuristic | Severity | Effort |
| ---- | ------------------------------------------------------------------------------------------------------ | --------- | -------- | ------ |
| 1    | **Move E-Stop state to server/global store** — local state resets on navigation, creating false status | H3, H5    | 4        | Medium |
| 2    | **Handle E-Stop API errors** — `.catch(() => null)` silently swallows failures and sets false state    | H9        | 4        | Low    |
| 3    | **Add typed-confirmation for global E-Stop** with robot count in dialog                                | H3, H5    | 3–4      | Low    |
| 4    | **Add hero prompts to all robotics screens** following the established cockpit pattern                 | H10       | 3        | Medium |
| 5    | **Replace undifferentiated map dots with shaped/sized markers per class** and add a legend             | H6, A.1   | 3        | Medium |
| 6    | **Fix overlapping map overlays** — alerts and playback controls clash at bottom                        | H8        | 3        | Low    |
| 7    | **Wire or disable playback controls** — non-functional interactive controls violate H1                 | H1        | 3        | Low    |
| 8    | **Add search and sorting to robot list and mission table**                                             | H7        | 3        | Medium |
| 9    | **Add keyboard support for map** — Escape to deselect, shortcuts for zoom/fit/layer toggles            | H3, H7    | 3        | Medium |
| 10   | **Add cross-links between Workflow Runs and Missions** to bridge the domain gap                        | IA.1, H10 | 3        | High   |

---

## What's Working Well (Preserve These)

1. **Triple-coded status badges** — Icon + text + colour on robot and mission status badges throughout the robotics section provide excellent redundancy.
2. **Confirmation flows for destructive actions** — E-Stop (per-robot and global) and mission cancel/pre-empt all require explicit confirmation before executing.
3. **Resizable map panels** — The `ResizablePanelGroup` on the Operations Map lets operators customize the map-to-list ratio for their workflow.
4. **FlyToSelected animation** — Selecting a robot smoothly pans the map to its location, maintaining spatial context.
5. **Safety page governance model** — Clean separation of constraints, approval thresholds, and audit log provides a comprehensive safety overview.
6. **Inline robot detail on map** — Selecting a robot shows details without navigating away from the map context.
7. **Class and status filter pills** — Familiar filter pattern on the Robots page enables quick fleet segmentation.
8. **Skeleton loading states** — The Robots page shows animated pulse placeholders during data loading (`robots.tsx` line 323–330).
9. **E-Stop audit log with actor tracking** — Records who activated and cleared E-Stops with timestamps and rationale — strong governance.
10. **Shared DataTable component** — Missions and Gateways pages use the shared `DataTable` component for consistent table UX.

---

## Methodology Note

This evaluation was conducted by reviewing the source code of all 6 robotics routes and their supporting components. The following files were analysed:

- `apps/cockpit/src/routes/robotics/index.tsx` — Robotics index page
- `apps/cockpit/src/routes/robotics/robots.tsx` — Robot fleet list
- `apps/cockpit/src/routes/robotics/map.tsx` — Operations map route
- `apps/cockpit/src/routes/robotics/missions.tsx` — Mission dispatch table
- `apps/cockpit/src/routes/robotics/safety.tsx` — Safety constraints and E-Stop
- `apps/cockpit/src/routes/robotics/gateways.tsx` — Gateway connectivity
- `apps/cockpit/src/components/cockpit/operations-map/map-view.tsx` — Leaflet map component
- `apps/cockpit/src/components/cockpit/operations-map/robot-list-panel.tsx` — Fleet sidebar list
- `apps/cockpit/src/components/cockpit/operations-map/robot-detail-panel.tsx` — Inline robot detail
- `apps/cockpit/src/components/cockpit/operations-map/alert-triage-panel.tsx` — Spatial alerts overlay
- `apps/cockpit/src/components/cockpit/operations-map/playback-controls.tsx` — Live/replay controls
- `apps/cockpit/src/components/cockpit/operations-map/layer-toggles.tsx` — Map layer visibility
- `apps/cockpit/src/components/cockpit/page-header.tsx` — Shared page header component
- `apps/cockpit/src/types/robotics.ts` — Robotics type definitions

---

## Post-Implementation Resolution Status

The following issues from this evaluation were addressed in the implementation phase (WP-1 through WP-7 + QA pass):

| Issue                                                     | Resolution                                                                                                                            | Work Package |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1.2 — Playback controls non-functional with no disclosure | Replay button now shows "Coming soon" toast; scrubber and speed controls are disabled in live mode                                    | WP-7         |
| 2.1 — "Halos" is jargon                                   | Renamed to "Uncertainty zones" in layer toggles                                                                                       | WP-4         |
| 3.2 — No "Fit All" button on the map                      | Added FitAllControl using `L.Control.extend` with `fitBounds()`                                                                       | WP-4         |
| 3.4 / 5.2 — E-Stop state is local, resets on navigation   | Replaced `useState` with `useGlobalEstopStatus` query hook; mutations use `useSetEstop`/`useClearEstop` with query invalidation       | WP-3         |
| 4.2 — No breadcrumbs on any robotics page                 | Added breadcrumbs to all 5 sub-pages (Robots, Map, Missions, Safety, Gateways)                                                        | WP-6         |
| 6.1 — Robot markers are tiny undifferentiated dots        | Refactored to 24/32px rounded-rect markers with class glyphs (R/A/M/U/P), status colour borders, and name labels                      | WP-4         |
| 6.2 — No map legend                                       | Added collapsible MapLegend panel showing status colours, class icons, and layer types                                                | WP-4         |
| 6.5 — Robotics index has no live counts                   | Added live stat tiles (robots online, active missions, spatial alerts) using existing query hooks                                     | WP-7         |
| 7.1 — No search in the robot list                         | Added search input filtering by name or ID in the map's robot list panel                                                              | WP-5         |
| 7.5 — No direct navigation between related entities       | Added cross-links: robot cards link to map, mission detail links to robot, robot detail links to mission, safety table links to fleet | WP-5         |
| 8.1 — Map overlays clash at bottom                        | Constrained AlertTriagePanel width (w-80), bumped PlaybackControls z-index to 1001                                                    | WP-1, QA     |
| 9.4 — E-Stop catch block silently swallows errors         | Replaced inline fetch with TanStack Query mutations; errors surface via mutation state                                                | WP-3         |
| 10.2 — No robot-workflow relationship explanation         | Added info callout on the robotics index page explaining RoboticsActuation port and governance chain                                  | WP-7         |

**Additional QA fixes** (not in original evaluation):

| Fix                                   | Detail                                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Dark theme: robot marker icons        | Replaced hardcoded `background:white` / `color:#333` with `var(--card)` / `var(--card-foreground)` CSS vars |
| Dark theme: FitAllControl button      | Same CSS var treatment for Leaflet native control                                                           |
| Dark theme: Leaflet zoom/bar controls | Added `.leaflet-bar a` CSS overrides using theme tokens                                                     |
| Dark theme: Safety status banner      | Replaced `bg-red-50`/`bg-green-50` with semantic `bg-destructive/10`/`bg-success/10`                        |
| MapLegend animation                   | CSS grid `grid-template-rows` transition for smooth expand/collapse                                         |
| MapLegend accessibility               | Added `aria-expanded` to toggle button                                                                      |

**Remaining open issues** from this evaluation (not yet addressed): 1.1, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4, 2.5, 3.1, 3.3, 3.5, 4.1, 4.3, 4.4, 4.5, 5.1, 5.3, 5.4, 5.5, 6.3, 6.4, 7.2, 7.3, 7.4, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.5, 10.1, 10.3, 10.4, 10.5, A.1–A.4, C.1–C.2, IA.1–IA.2.

---

A complete evaluation would additionally require:

- Testing with all personas (Operator, Safety Officer, Fleet Manager, Admin)
- Testing error states and empty states across all screens
- Testing on mobile and smaller viewports (map responsiveness)
- Testing keyboard navigation flows end-to-end (especially map interactions)
- Testing with screen reader (NVDA/JAWS) on map and dynamic content
- Live interaction testing with actual WebSocket-driven robot location updates
- User testing with 5+ representative robotics operators
- Cross-section testing of the Workflow-to-Mission flow with real data
