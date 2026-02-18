# UX Design: WCAG 2.2 AA Accessibility and Keyboard-First Navigation

**Bead:** bead-0476
**Status:** Done
**Date:** 2026-02-18

---

## 1. Overview

Every screen in the cockpit must meet WCAG 2.2 Level AA. This document specifies the implementation requirements across five domains: focus management, screen reader support, keyboard navigation, aria attributes, and colour contrast.

---

## 2. Focus Management

### Skip Links

A visually hidden Skip to main content link is the first focusable element on every page. Becomes visible on focus. A second skip link Skip to navigation is provided for pages with long page-level navigation.

### Modal Dialogs and Drawers

- On open: focus moves to the first focusable element inside the modal (usually the heading or first input).
- While open: Tab and Shift+Tab cycle only within the modal (focus trap).
- On close (Escape, Cancel, or primary action): focus returns to the element that triggered the modal.
- Implementation: use inert attribute on the background DOM, or a focus-trap library that sets aria-hidden=true on background content.

### Page Navigation

- On route change: focus moves to the h1 of the new page, or to a visually-hidden Page loaded: [Page name] announcement region.
- Back/forward navigation restores scroll position and focus to a reasonable starting element.

### Dynamic Content

- When new content is injected into the page: focus is not moved unless the user explicitly triggered the action.
- Exception: after a form submit that replaces the form with a success message, focus moves to the success message heading.

---

## 3. Screen Reader Support

### aria-label for Icon-Only Buttons

Every button or link whose visible label is an icon only must have aria-label. The aria-label must describe the action, not the icon (e.g. Close panel, not X or Cross).

### aria-live Regions

| Region                  | aria-live level | Usage                                 |
| ----------------------- | --------------- | ------------------------------------- |
| Connection status badge | polite          | Connection state changes              |
| Staleness indicator     | polite          | Timer updates (max once per minute)   |
| Offline banner          | assertive       | Immediate network loss                |
| Error banners           | assertive       | Critical errors requiring user action |
| Toast notifications     | polite          | Success/info notifications            |
| Log viewer (tail off)   | off             | No announcements when tail is off     |
| Form validation errors  | assertive       | Field-level validation on submit      |
| Loading complete        | polite          | Results loaded after async fetch      |

### aria-expanded for Collapsible Sections

All disclosure widgets (accordion, Show more, settings toggle) use aria-expanded and aria-controls. State toggles to aria-expanded=true and hidden attribute removed on expand.

### Page Titles

Each route has a unique, descriptive title in the format: [Page name] - Portarium Cockpit

---

## 4. Keyboard Navigation

### Tab Order

- Follows DOM order (no positive tabindex values).
- tabindex=0 used only for custom interactive elements that are not natively focusable.
- tabindex=-1 used for programmatic focus targets (modal heading, skip link target).

### Enter / Space

| Element           | Enter       | Space               |
| ----------------- | ----------- | ------------------- |
| button            | Activate    | Activate            |
| a                 | Follow link | - (browser default) |
| Checkbox          | -           | Toggle              |
| role=switch       | Toggle      | Toggle              |
| role=tab          | Select      | Select              |
| Disclosure button | Toggle      | Toggle              |

### Escape Key

| Context           | Escape behaviour                    |
| ----------------- | ----------------------------------- |
| Modal dialog      | Close modal, return focus           |
| Slide-over drawer | Close drawer, return focus          |
| Dropdown menu     | Close menu, return focus to trigger |
| Tooltip           | Close tooltip                       |
| Date picker       | Close picker                        |
| Inline editing    | Cancel edit, revert value           |

### Arrow Keys

- Dropdown / select: Up/Down arrows cycle options.
- Tab list: Left/Right arrows cycle tabs.
- Data table: Arrow keys navigate cells (when role=grid is used).
- Tree / sidebar nav: Up/Down navigate nodes; Right expands; Left collapses.
- Workflow state machine SVG: Arrow keys navigate between focusable nodes.

### Keyboard Shortcuts (Global)

| Shortcut | Action                                      |
| -------- | ------------------------------------------- |
| ?        | Open keyboard shortcut help modal           |
| Shift+R  | Manual refresh                              |
| Shift+N  | New workflow (from Workflows screen)        |
| Shift+F  | Focus search/filter input on current screen |
| Esc      | Close modal/drawer/popover                  |

Keyboard shortcuts are disabled when focus is inside a text input or textarea.

---

## 5. ARIA Attributes Reference

### Data Tables

Use table role=table with aria-label. th elements use role=columnheader with aria-sort for sortable columns. Switches use role=switch with aria-checked and descriptive aria-label including the item name.

### Role Alert for Critical Errors

Critical error banners use role=alert with aria-live=assertive.

### aria-describedby for Complex Widgets

Complex form widgets have aria-describedby pointing to a visually hidden description paragraph.

### Busy State for Async Operations

Buttons during async operations use aria-busy=true and disabled=true. The button label updates to a progressive form (Saving...).

---

## 6. Colour Contrast

### Text Contrast Ratios (AA requirements)

| Use case             | Minimum ratio | Current token                | Ratio    |
| -------------------- | ------------- | ---------------------------- | -------- |
| Normal text on white | 4.5:1         | --color-neutral-700 on white | 7.0:1 OK |
| Large text on white  | 3:1           | --color-neutral-500 on white | 3.9:1 OK |
| Error text           | 4.5:1         | --color-error-700 on white   | 5.8:1 OK |
| Warning text         | 4.5:1         | --color-warning-700 on white | 4.9:1 OK |
| Success text         | 4.5:1         | --color-success-700 on white | 5.2:1 OK |
| Disabled text        | 3:1 (AA)      | --color-neutral-400 on white | 3.1:1 OK |
| Link text            | 4.5:1         | --color-primary-700 on white | 5.5:1 OK |

### No Colour-Only Information

Every status/state conveyed by colour must also be conveyed by: Text label, OR Icon with aria-label, OR Pattern/shape. Examples: Connection status uses symbol (circle/half-circle/empty) + text label + colour. Error badge uses X icon + red colour + Error text.

### Focus Indicators

Focus ring: 3 px solid --color-primary-600, 2 px offset. Contrast of focus ring against adjacent background: >= 3:1 (WCAG 2.2 2.4.11). No CSS outline: none without providing a custom focus indicator.

---

## 7. Implementation Checklist

A per-feature checklist to be completed before merging any cockpit PR:

- [ ] All icon-only buttons have aria-label
- [ ] All modals trap focus and return focus on close
- [ ] Skip links present and tested with keyboard
- [ ] aria-live regions present for all async status changes
- [ ] aria-expanded / aria-controls on all disclosure widgets
- [ ] role=table and aria-sort on all data tables
- [ ] role=alert on all critical error banners
- [ ] aria-describedby on all complex form widgets
- [ ] Keyboard shortcut help modal accessible and complete
- [ ] Tab order follows visual reading order
- [ ] Escape key closes all overlays
- [ ] Arrow key navigation implemented for tab lists and dropdowns
- [ ] Colour contrast verified for all new colour pairings
- [ ] No information conveyed by colour alone
- [ ] prefers-reduced-motion respected for all animations
