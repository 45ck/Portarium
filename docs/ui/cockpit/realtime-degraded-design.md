# UX Design: Real-Time Updates and Degraded Mode

**Bead:** bead-0462
**Status:** Done
**Date:** 2026-02-18

---

## 1. Overview

The cockpit relies on a server-sent event (SSE) stream for live data. When that stream is healthy the UI reflects reality within milliseconds. When it degrades or fails the cockpit must remain usable, communicate its state honestly, and recover automatically or on demand.

---

## 2. Connection Status — Status Bar Indicator

The rightmost slot of the global status bar shows a persistent connection badge.

| Symbol | Label     | Colour token          | Meaning                                                      |
| ------ | --------- | --------------------- | ------------------------------------------------------------ |
| ●      | Connected | `--color-success-600` | SSE stream open, last heartbeat < 5 s ago                    |
| ◐      | Degraded  | `--color-warning-500` | Stream open but heartbeat missed 1–3 times, or latency > 2 s |
| ○      | Offline   | `--color-neutral-400` | Stream closed or missed > 3 heartbeats                       |

The badge is always visible — it is never hidden behind a menu or collapsed on mobile viewports. Badge text is suppressed below 640 px breakpoint; only the symbol remains, with a title attribute for pointer hover.

### Interaction

Clicking the badge opens a popover with:

- Current state label and duration (Degraded for 42 s)
- Last successful event timestamp
- Reconnect button (visible in Degraded and Offline states)
- Technical detail toggle: shows WebSocket/SSE endpoint URL, last error code

---

## 3. Staleness Indicator

When the stream enters Degraded or Offline state, a secondary label appears directly beneath the primary page heading:

    ⚠ Last updated 3 m ago   [Refresh now]

- The timer auto-increments every 60 s using setInterval.
- Format: < 1 m ago → 1 m ago → 2 m ago … → X h ago
- The indicator is hidden while the stream is in Connected state.
- Colour escalation: neutral below 5 m, warning (amber) at 5–15 m, error (red) above 15 m.

---

## 4. Fallback Polling Mode

When the SSE stream has been Offline for > 30 s the cockpit automatically switches to polling mode.

### Banner

A persistent banner appears at the top of the main content area (below the global nav, above page content):

    [⚠ icon]  Live updates unavailable. Refreshing every 30 s.
              [Adjust interval ▾]   [Reconnect to live stream]

- Banner colour: `--color-warning-50` background, `--color-warning-700` border.
- Adjust interval opens an inline select: 15 s / 30 s / 60 s / Manual only.
- Banner persists until the SSE stream reconnects successfully.

### Polling Interval Indicator

A small clock icon + countdown (Next refresh in 18 s) appears in the status bar slot, replacing the staleness label, while polling is active.

---

## 5. Manual Refresh Button

A [Refresh] button is available:

- In the staleness indicator (always while degraded/offline).
- In the polling mode banner.
- Via keyboard shortcut Shift+R (announced in the keyboard help modal).

On activation the button shows a spinner for the duration of the fetch and reverts to its resting state on completion or error. If the fetch fails an inline error message replaces the staleness label for 5 s.

---

## 6. Reconnection Progress Indicator

When the cockpit attempts to reconnect (automatic exponential back-off or manual trigger):

1. The status bar badge changes to ◐ Degraded with a pulsing animation.
2. A thin progress bar (indeterminate) appears beneath the global nav.
3. Attempt counter shown in the badge popover: Reconnect attempt 3 of 10.
4. Back-off delay shown: Retrying in 8 s…

On success: progress bar fills green and disappears after 1 s, badge flips to ● Connected, staleness indicator and polling banner dismissed.

On exhausting retries (10 attempts): progress bar disappears, badge stays ○ Offline, banner updates to Could not reconnect. [Try again].

---

## 7. Offline Mode — Full Data Unavailable Banner

When the cockpit detects complete network loss (navigator.onLine = false, or all XHR/fetch calls failing):

    ┌──────────────────────────────────────────────────────────────────┐
    │  ○  You are offline. Some data may be stale or unavailable.      │
    │     Actions that require a network connection are disabled.       │
    └──────────────────────────────────────────────────────────────────┘

- Banner colour: `--color-neutral-100` background, `--color-neutral-500` border.
- Interactive elements that would trigger network requests are visually dimmed (opacity: 0.4) and have aria-disabled=true.
- Cached / stale data is still displayed with a ⚠ Stale badge on each data card.
- The banner auto-dismisses when online status is restored.

---

## 8. Nielsen Heuristic Review

| Heuristic                                                  | Application                                                                                                                                    |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **#1 Visibility of system status**                         | Connection state badge always visible in status bar; staleness timer keeps users informed about data age.                                      |
| **#5 Error prevention**                                    | Actions requiring live data are disabled (not just hidden) when offline; prevents user from submitting changes against stale state.            |
| **#9 Help users recognise, diagnose, recover from errors** | Popover shows error code; reconnect button is one click; banner explains the degraded state in plain language.                                 |
| **#3 User control and freedom**                            | Manual refresh available at all times; user can adjust poll interval; user can trigger reconnect rather than waiting for back-off.             |
| **#4 Consistency and standards**                           | Traffic-light metaphor (●/◐/○) is consistent with system tray conventions; escalating amber/red colour matches status severity across cockpit. |

---

## 9. Accessibility (WCAG 2.2 AA)

- **aria-live=polite** on the connection state badge container: connection changes are announced without interrupting current task.
- **aria-live=assertive** on the full offline banner so screen readers announce it immediately.
- **role=status** on the staleness indicator region.
- All icon-only buttons (Refresh, Reconnect) have aria-label.
- The pulsing animation respects prefers-reduced-motion: animation is replaced with a static icon swap.
- Colour-blind safe: status symbols (●/◐/○) carry meaning independently of colour; colour is supplementary only.
- Keyboard: badge popover is reachable by Tab, dismissible with Escape.
- Contrast ratios: warning amber on white background meets 4.5:1 minimum for normal text.

---

## 10. Component Props (TypeScript sketch)

```ts
type ConnectionState = connected | degraded | offline;

interface ConnectionStatusBadgeProps {
  state: ConnectionState;
  lastEventAt: Date | null;
  attempt?: number;
  maxAttempts?: number;
  retryInMs?: number;
  onReconnect: () => void;
  onManualRefresh: () => void;
}

interface StalenessIndicatorProps {
  lastUpdatedAt: Date;
  visible: boolean;
}

interface PollingBannerProps {
  intervalSeconds: number;
  nextRefreshIn: number;
  onIntervalChange: (s: 15 | 30 | 60) => void;
  onReconnect: () => void;
}
```
