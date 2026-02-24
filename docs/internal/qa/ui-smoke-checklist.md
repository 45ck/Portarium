# UI Smoke Checklist

## Scope

Verify that all routes load, the core layout is visible, and the browser console is
free of errors across the primary Cockpit views.

## Prerequisites

- Cockpit dev server running: `cd apps/cockpit && npx vite`
- Mock Service Worker active (browser console shows `[MSW] Mocking enabled`)
- Browser dev tools console open

## Checklist

### Shell and navigation

| #   | Step                                                           | Pass | Fail | Notes |
| --- | -------------------------------------------------------------- | :--: | :--: | ----- |
| 1   | Open `http://localhost:5173` — page loads without blank screen |  ☐   |  ☐   |       |
| 2   | Left sidebar is visible with navigation links                  |  ☐   |  ☐   |       |
| 3   | Top header shows product logo and workspace name               |  ☐   |  ☐   |       |
| 4   | No red errors in browser console on initial load               |  ☐   |  ☐   |       |
| 5   | Theme toggle in settings switches between light and dark mode  |  ☐   |  ☐   |       |

### Primary route load

| #   | Route                    | Loads | No Console Error |  Page Title   | Notes |
| --- | ------------------------ | :---: | :--------------: | :-----------: | ----- |
| 6   | `/dashboard`             |   ☐   |        ☐         |   Dashboard   |       |
| 7   | `/inbox`                 |   ☐   |        ☐         |     Inbox     |       |
| 8   | `/runs`                  |   ☐   |        ☐         |     Runs      |       |
| 9   | `/approvals`             |   ☐   |        ☐         |   Approvals   |       |
| 10  | `/work-items`            |   ☐   |        ☐         |  Work Items   |       |
| 11  | `/evidence`              |   ☐   |        ☐         |   Evidence    |       |
| 12  | `/workforce`             |   ☐   |        ☐         |   Workforce   |       |
| 13  | `/workflows`             |   ☐   |        ☐         |   Workflows   |       |
| 14  | `/robotics`              |   ☐   |        ☐         |   Robotics    |       |
| 15  | `/config/agents`         |   ☐   |        ☐         |    Agents     |       |
| 16  | `/config/adapters`       |   ☐   |        ☐         |   Adapters    |       |
| 17  | `/config/settings`       |   ☐   |        ☐         |   Settings    |       |
| 18  | `/explore/observability` |   ☐   |        ☐         | Observability |       |
| 19  | `/explore/events`        |   ☐   |        ☐         |    Events     |       |
| 20  | `/explore/governance`    |   ☐   |        ☐         |  Governance   |       |
| 21  | `/search`                |   ☐   |        ☐         |    Search     |       |

### Layout integrity

| #   | Step                                                           | Pass | Fail | Notes |
| --- | -------------------------------------------------------------- | :--: | :--: | ----- |
| 22  | Sidebar navigation links are all visible (not overflowing)     |  ☐   |  ☐   |       |
| 23  | Each page has a visible page header (title + breadcrumb)       |  ☐   |  ☐   |       |
| 24  | KPI row (if present on dashboard) renders without layout shift |  ☐   |  ☐   |       |
| 25  | Command palette opens with `⌘K` / `Ctrl+K`                     |  ☐   |  ☐   |       |
| 26  | Keyboard cheatsheet opens via `?` key                          |  ☐   |  ☐   |       |
| 27  | Offline sync banner does not appear in online state            |  ☐   |  ☐   |       |

## Pass criteria

All rows must show **Pass**. Any **Fail** requires a GitHub issue with route and
console error attached.

## Related automated tests

```
npm run -w apps/cockpit test -- src/routes/page-load.test.tsx
```
