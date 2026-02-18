# UX Design: Performance Perception

**Bead:** bead-0478
**Status:** Done
**Date:** 2026-02-18

---

## 1. Overview

Performance perception design ensures that the cockpit feels fast even when operations are slow. Techniques include skeleton screens, lazy loading, smart pagination, granular loading states, and optimistic UI.

---

## 2. Skeleton Screens

Skeleton screens are shown in place of content during initial load (before any data arrives). They match the shape of the real content to reduce layout shift and cognitive dissonance.

### Runs List Skeleton

Grey placeholder rows matching the table structure. Skeleton cells use --color-neutral-200 fill with a shimmer animation (left-to-right gradient sweep, 1.5 s loop). Number of skeleton rows = the configured page size (10 by default). Shown for: first load, sort change, filter change, page change.

### Evidence List Skeleton

Same approach as Runs List: skeleton rows matching the timeline entry shape (circle node + two lines of text per entry).

### Agent Cards Skeleton

Grid of 6 placeholder cards (matching the card grid layout) with skeleton title, status badge, and two metric lines per card.

### Skeleton Duration

- Skeleton is shown for a minimum of 200 ms to avoid a flash.
- If data arrives in < 200 ms the skeleton is held until 200 ms elapses, then the real content is shown without animation.

### Accessibility

- Skeleton containers have aria-busy=true and aria-label=Loading.
- Shimmer animation respects prefers-reduced-motion: replaced with a static grey placeholder.

---

## 3. Lazy Loading Strategy

### Route-Level Code Splitting

Heavy routes are loaded on demand, not bundled into the main chunk:

| Route             | Split chunk                | Approx size |
| ----------------- | -------------------------- | ----------- |
| Workflow Builder  | workflow-builder.chunk.js  | ~180 kB     |
| Evidence Explorer | evidence-explorer.chunk.js | ~120 kB     |
| Observability     | observability.chunk.js     | ~95 kB      |
| IAM / Policy      | governance.chunk.js        | ~75 kB      |

### Loading Indicator for Route Transitions

When navigating to a lazily-loaded route, a thin progress bar appears at the top of the viewport. Starts at 0%, animates to 70% quickly (200 ms), then to 100% when the chunk is loaded. Bar colour: --color-primary-500. Stays visible for a minimum of 300 ms to avoid a flash.

### Image and Asset Lazy Loading

- All images use native loading=lazy.
- Icons are inline SVG (no network fetch).

---

## 4. Pagination Patterns

### Cursor-Based Pagination

All list screens (Runs, Evidence, Adapters, Users) use cursor-based pagination. Page size options: 10 / 25 / 50 items per page. Navigation controls: [<- Previous] [Page 3 of 8] [Next ->]. Page size selector is a select with aria-label=Items per page.

### Load More (Infinite Scroll Contexts)

Used in the log viewer and notification feed where users scroll continuously. Load more button is preferred over automatic infinite scroll because automatic scroll interferes with keyboard navigation and screen readers. When all entries are loaded: Showing all N entries. aria-live=polite on the list container announces when new entries are appended.

---

## 5. Loading States

### Button Spinner (Async Actions)

During any async action triggered by a button (save, approve, run, revoke): button uses aria-busy=true and disabled=true. Original label replaced with progressive form: Save -> Saving.... Spinner: 16 x 16 px CSS animation, --color-primary-600. Button returns to resting state on success or error. Duration: minimum 300 ms spinner visible to avoid flash.

### Progress Indicator for Long Operations

For operations > 2 s (chain verification, bulk export, report generation):

Verifying evidence chain...
[####################.................] 58 %
Estimated time remaining: 12 s
[Cancel]

- Determinate progress bar when server reports progress percentage.
- Indeterminate (animated gradient) when no progress signal is available.
- Cancel button aborts the operation and restores previous state.
- role=progressbar, aria-valuenow, aria-valuemin, aria-valuemax, aria-label=Verifying evidence chain, 58 percent complete.
- Progress percentage announced to screen readers via aria-live=polite at 10-percentage-point increments.

---

## 6. Optimistic UI

### Principle

Show the result of an action immediately in the UI, before the server confirms. Revert to the previous state if the server returns an error.

### Applied Patterns

| Action                            | Optimistic update                  | Revert behaviour                          |
| --------------------------------- | ---------------------------------- | ----------------------------------------- |
| Enable/disable policy rule toggle | Toggle flips immediately           | Toggle reverts + error banner             |
| Delete item                       | Item removed from list immediately | Item re-inserted + error banner           |
| Approve workflow step             | Status chip shows Approved         | Status reverts to PendingApproval + error |
| Add tag to resource               | Tag appears immediately            | Tag removed + error                       |

### Revert Animation

When reverting an optimistic update: The changed element flashes with a brief red tint (200 ms). The value reverts to its previous state. An error banner appears: Could not [action]. [Retry]. The flash animation respects prefers-reduced-motion.

### Conflict Detection

If a server response contains a newer version of the resource that conflicts with the optimistic update, the UI shows: This item was updated by another user while you were editing. [View latest version] [Overwrite with my changes]

---

## 7. Nielsen Heuristic Review

| Heuristic                                      | Application                                                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#1 Visibility of system status**             | Skeleton screens confirm that data is loading; progress bars give time estimates; button spinners confirm that an action is in progress.                      |
| **#7 Flexibility and efficiency**              | Power users can increase page size to 50; pagination bookmarks state in URL for deep linking; cursor-based pagination avoids count queries on large datasets. |
| **#3 User control and freedom**                | Cancel button on long operations; optimistic reverts restore previous state cleanly; load-more preferred over auto-scroll for user control.                   |
| **#4 Consistency and standards**               | Skeleton shimmer direction (left-to-right) is consistent across all loading contexts; spinner size and colour consistent across all async buttons.            |
| **#9 Help users recognise, diagnose, recover** | Optimistic revert includes error banner with retry; conflict detection offers clear options for resolution.                                                   |

---

## 8. Accessibility: Loading States and Screen Readers

- Skeleton containers: aria-busy=true, aria-label=Loading content.
- When content replaces skeleton: aria-busy=false; a visually hidden aria-live=polite region announces Content loaded (once).
- Button spinner: parent button has aria-busy=true; label updates to progressive form (Saving...) so screen readers announce the state change.
- Progress bar: full ARIA progressbar pattern (see section 5 above).
- Load more button: on activation, new items appended; aria-live=polite region announces 20 more entries loaded after append completes.
- Optimistic revert: error banner uses role=alert for immediate announcement.
- Route transition progress bar: aria-hidden=true (purely decorative); route change is announced via the page h1 focus move.
