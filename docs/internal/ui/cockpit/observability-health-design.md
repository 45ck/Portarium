# UX Design: Observability and Health Dashboard

**Bead:** bead-0470
**Status:** Done
**Date:** 2026-02-18

---

## 1. Overview

The Observability screen gives platform operators a unified view of system health: OpenTelemetry traces, live metric sparklines, and a structured log viewer.

---

## 2. Screen Layout

Three rows:

1. Top row: 4 metric cards with sparklines.
2. Middle row: Trace list (left) + Span waterfall / detail (right).
3. Bottom row: Log viewer.

Rows are resizable via drag handles. Default split: 15% / 45% / 40%.

---

## 3. Metric Cards (Top Row)

Each card shows: Metric name, Current value (large number), Trend sparkline (last 24 h, 48 data points), Change indicator vs previous period.

### Metrics

| Card               | Metric                      | Warning threshold | Error threshold |
| ------------------ | --------------------------- | ----------------- | --------------- |
| API latency        | p50 response time           | > 200 ms          | > 500 ms        |
| Worker queue depth | Pending jobs                | > 50              | > 200           |
| Error rate         | 5xx errors / total requests | > 1%              | > 5%            |
| p95 Latency        | p95 response time           | > 400 ms          | > 1 s           |

- Cards exceed warning threshold: amber background, amber sparkline.
- Cards exceed error threshold: red background, red sparkline, metric value bold red.

Sparkline: aria-label on SVG with minimum, maximum, and current values.

---

## 4. OTel Traces View

### Trace List (Left Panel)

Columns: Trace ID (truncated, hover for full), Root service, Total duration, Status (circle success / X error). Clicking a row loads the span waterfall in the right panel. Trace list supports search by trace ID, service name, or minimum duration filter. Load more button at bottom (cursor-based pagination, 20 traces per page).

### Span Waterfall (Right Panel)

trace_abc 245 ms
├─ api-gw [##########] 245 ms
├─ workflow-svc [ ######] 210 ms
└─ db-adapter [ ######] 180 ms

Each span is a horizontal bar proportional to its duration. Colour: service colour (assigned from a fixed palette, consistent per service name). Clicking a span expands an attributes panel below.

### Service Map

A toggle Service map above the waterfall switches to a node-graph view showing services as nodes and calls as directed edges, weighted by call volume.

---

## 5. Structured Log Viewer (Bottom Row)

### Controls

- Level filter (multi-select dropdown): DEBUG / INFO / WARN / ERROR / FATAL
- Search (text input): full-text search across log message and service name
- Tail mode toggle: auto-scrolls to latest log entry; new entries animate in from bottom
- Clear button: clears the visible log buffer (does not delete server-side logs)

### Log Entry Format

[timestamp] [LEVEL] [service] [message]

Level colour coding: DEBUG: neutral-400, INFO: neutral-700, WARN: warning-600, ERROR: error-600, FATAL: error-700 bold.

Clicking a log entry expands structured fields (JSON key/value pairs) inline.

---

## 6. Screen States

### All Healthy

Default colours; sparklines in neutral grey; no warning callouts.

### High Error Rate

Error rate card turns red. A banner appears: Error rate is 7.2% - above the 5% threshold. [View error traces]. Trace list auto-filters to show only errored traces.

### Trace Search

Search input in trace list filters list in real time (debounced 300 ms). A Showing 3 of 142 traces count appears below the search input.

### Log Grep

Search input in log viewer highlights matching text in log messages. A match count (42 matches) appears next to the input. Enter/Shift+Enter navigates between matches.

---

## 7. Nielsen Heuristic Review

| Heuristic                              | Application                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **#1 Visibility of system status**     | Metric cards always visible at top; colour escalation gives immediate health signal; Tail mode keeps log current.         |
| **#6 Recognition over recall**         | Service map and waterfall make trace context visible; users do not need to mentally reconstruct call chains.              |
| **#7 Flexibility and efficiency**      | Advanced users can grep logs, filter by level, search traces, adjust time range; casual users can glance at metric cards. |
| **#4 Consistency and standards**       | Log level colours and severity ordering follow industry conventions (DEBUG < INFO < WARN < ERROR < FATAL).                |
| **#8 Aesthetic and minimalist design** | Sparklines are small; only current value shown in large type; detail available on demand via hover/click.                 |

---

## 8. Accessibility (WCAG 2.2 AA)

- Sparkline SVGs: role=img, aria-label with min/max/current values, a hidden title element with the same content.
- Metric cards: aria-live=polite on the current value span so updates are announced without interrupting the user.
- Trace list: role=table with proper th and td; sortable columns have aria-sort.
- Span waterfall bars: role=listitem with aria-label containing service name and duration.
- Log entries: navigable via keyboard (Up/Down arrows while focus is inside the log viewer); each entry is a div role=row inside a role=log region.
- Log viewer has aria-live=polite in normal mode; in Tail mode a New entries available button appears for keyboard users when tailing.
- Level filter multi-select: aria-multiselectable=true.
- Error rate banner: role=alert.
