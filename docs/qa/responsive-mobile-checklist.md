# Responsive / Mobile QA Checklist

## Scope

Verify the Cockpit UI at mobile viewport widths (< 640 px), including the bottom
navigation bar, filter-bar wrapping, and touch-friendly interaction targets.

## Prerequisites

- Cockpit dev server running: `cd apps/cockpit && npx vite`
- Browser DevTools open — toggle **Device Toolbar** (Chrome: `Ctrl+Shift+M`)
- Set viewport to **390 × 844** (iPhone 14 equivalent)
- Alternative: use `npm run ab -- open http://localhost:5173 --headed` and
  resize to mobile dimensions

## Viewport sizes to test

| Label    |  Width |  Height | Notes          |
| -------- | -----: | ------: | -------------- |
| Mobile S | 320 px |  568 px | iPhone SE      |
| Mobile M | 375 px |  812 px | iPhone X       |
| Mobile L | 414 px |  896 px | iPhone XR      |
| Tablet   | 768 px | 1024 px | Boundary check |

---

## Checklist

### Bottom navigation bar (< 640 px)

| #   | Step                                                   | Pass | Fail | Notes |
| --- | ------------------------------------------------------ | :--: | :--: | ----- |
| 1   | At 390 px width, left sidebar is hidden                |  ☐   |  ☐   |       |
| 2   | Bottom navigation bar appears with primary route icons |  ☐   |  ☐   |       |
| 3   | Bottom nav icons are tappable (min 44 × 44 px target)  |  ☐   |  ☐   |       |
| 4   | Active route highlighted in bottom nav                 |  ☐   |  ☐   |       |
| 5   | Tapping a bottom nav icon navigates correctly          |  ☐   |  ☐   |       |

### Filter bar wrapping

| #   | Step                                                                   | Pass | Fail | Notes |
| --- | ---------------------------------------------------------------------- | :--: | :--: | ----- |
| 6   | On `/runs` at 390 px — filter bar wraps to 2 rows without overflow     |  ☐   |  ☐   |       |
| 7   | Filter chips/buttons remain fully visible and tappable                 |  ☐   |  ☐   |       |
| 8   | On `/approvals` at 390 px — filter bar wraps without horizontal scroll |  ☐   |  ☐   |       |
| 9   | Search input in filter bar is full-width at mobile                     |  ☐   |  ☐   |       |

### Content readability

| #   | Step                                                                 | Pass | Fail | Notes |
| --- | -------------------------------------------------------------------- | :--: | :--: | ----- |
| 10  | Card list items readable at 390 px (no text truncation to < 3 chars) |  ☐   |  ☐   |       |
| 11  | Tables fall back to card/list layout at mobile width                 |  ☐   |  ☐   |       |
| 12  | Approval triage card readable at 390 px                              |  ☐   |  ☐   |       |
| 13  | Page header title does not overflow the header container             |  ☐   |  ☐   |       |

### Drawers and sheets

| #   | Step                                                         | Pass | Fail | Notes |
| --- | ------------------------------------------------------------ | :--: | :--: | ----- |
| 14  | Human task drawer opens full-screen on mobile                |  ☐   |  ☐   |       |
| 15  | Drawer can be closed by swiping down or tapping the backdrop |  ☐   |  ☐   |       |
| 16  | Approval detail sheet is scrollable at 390 px height         |  ☐   |  ☐   |       |

### Robotics map (< 640 px)

| #   | Step                                                     | Pass | Fail | Notes |
| --- | -------------------------------------------------------- | :--: | :--: | ----- |
| 17  | On `/robotics/map` at 390 px — map renders at full width |  ☐   |  ☐   |       |
| 18  | Mobile bottom sheet (robot list) appears below the map   |  ☐   |  ☐   |       |
| 19  | Tapping a robot on the map opens the robot detail sheet  |  ☐   |  ☐   |       |

### Tablet boundary (768 px)

| #   | Step                                                                 | Pass | Fail | Notes |
| --- | -------------------------------------------------------------------- | :--: | :--: | ----- |
| 20  | At 768 px — sidebar may be hidden (collapsed) or visible; no overlap |  ☐   |  ☐   |       |
| 21  | No content clips or overflows the viewport at 768 px                 |  ☐   |  ☐   |       |

## Pass criteria

All rows must show **Pass** at the 390 px viewport. Rows 1–5 (bottom nav) and
rows 6–9 (filter bar) are critical path.

## Related automated tests

```
npm run -w apps/cockpit test -- src/routes/mobile-shell.test.tsx
npm run -w apps/cockpit test -- src/components/cockpit/operations-map/mobile-map-layout.test.tsx
```
