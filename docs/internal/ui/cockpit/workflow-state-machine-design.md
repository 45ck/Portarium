# UX Design: Workflow Execution State Machine Visualization

**Bead:** bead-0466
**Status:** Done
**Date:** 2026-02-18

---

## 1. Overview

The workflow detail screen shows the full lifecycle of a workflow run as an interactive state machine diagram. Users can inspect the current state, review completed transitions, understand branching logic, and diagnose failures without leaving the screen.

---

## 2. Lifecycle Node Diagram

### Node Sequence (nominal path)

[Pending] → [Running] → [PendingApproval] → [Approved] → [Executing] → [Completed]
⇘ [Failed]
⇘ [Cancelled]

### Visual Language

| Element              | Appearance                                                |
| -------------------- | --------------------------------------------------------- |
| State node           | Rounded rectangle, 120 x 48 px                            |
| Current state        | Filled with --color-primary-600, white label, drop shadow |
| Completed state      | --color-success-100 fill, --color-success-700 border      |
| Pending/future state | --color-neutral-100 fill, --color-neutral-400 border      |
| Failed state         | --color-error-100 fill, --color-error-700 border          |
| Cancelled state      | --color-neutral-200 fill, strikethrough label             |
| Transition arrow     | 2 px solid, --color-neutral-400, arrowhead                |
| Active transition    | Animated dashed line (CSS stroke-dashoffset)              |

Nodes are laid out left-to-right using a dagre-style auto-layout algorithm. The diagram is rendered as inline SVG so it is keyboard-navigable and supports aria attributes.

---

## 3. Transition Arrows

Each arrow is labelled with the event name that triggers the transition, e.g.: submitted (Pending → Running), approval_required (Running → PendingApproval), approved (PendingApproval → Approved), started (Approved → Executing), succeeded (Executing → Completed), errored (Executing → Failed), cancelled (any → Cancelled).

Labels appear in a small pill (12 px, --color-neutral-600) above/below the arrow midpoint.

---

## 4. Branching Visualization

Decision points (conditional steps) are shown as diamond nodes between states:

[Running] → ◆ condition? → [Yes path: Executing]
→ [No path: Completed (skipped)]

- Diamond fill: --color-warning-100; border: --color-warning-600.
- Yes branch arrow: solid green.
- No branch arrow: dashed grey.
- Clicking a diamond node opens a popover showing the condition expression and the evaluated result (true/false) for the current run.

---

## 5. Compensation / Rollback Path

When a failed step triggers compensation:

- A red dashed arrow connects Failed → a Compensating node → Rolled Back.
- Compensating node fill: --color-error-50; border: --color-error-400 dashed.
- Rolled Back node: grey, italicised label.

[Executing] → [Failed] ---↳ [Compensating] → [Rolled Back]

The dashed style unambiguously distinguishes rollback from the nominal path.

---

## 6. Retry Indicator

Nodes that have been retried show a circular badge in the top-right corner of the node with the retry count. Badge background: --color-warning-500; white number; 20 x 20 px circle. Tooltip: Retried 3 times. Max retries: 5. Badge is absent when retry count = 0.

---

## 7. Per-Node Timing Display

Hovering or focusing a node shows a tooltip with: state name, Started timestamp, Duration, Ended timestamp. For the currently active node, duration is a live counter. A compact duration label (4 m 12 s) appears beneath each completed node label in the diagram without hover.

---

## 8. State Variants

### 8.1 Nominal Flow

All nodes Pending → Running → Executing → Completed rendered in their default success styles.

### 8.2 Approval-Gated Pause

Current state is PendingApproval. PendingApproval node is highlighted (blue fill). A persistent callout in the right panel: Waiting for approval. Assigned to: compliance-team. Requested: 3 h ago. [Approve] [Deny] [Request changes]

### 8.3 Partial Failure with Compensation

Failed node is red. Compensating node visible with dashed red arrow. Right panel shows error details and compensation log links.

### 8.4 Timeout

A node in the Running state with elapsed time exceeding the configured timeout shows an amber Timed out badge. The system then transitions it to Failed; the node turns red and the timeout badge persists.

---

## 9. Nielsen Heuristic Review

| Heuristic                                      | Application                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **#1 Visibility of system status**             | Current state highlighted in primary blue; live duration counter on active node; retry badge shows accumulating retries in real time. |
| **#6 Recognition over recall**                 | Full state machine visible at once; no need to remember transition rules; event labels on arrows explain why transitions happened.    |
| **#2 Match between system and real world**     | Node labels use business language (Pending, Approved, Completed) not internal enum values; arrow labels match domain event names.     |
| **#9 Help users recognise, diagnose, recover** | Failure node shows error in right panel; compensation path visually distinct; View error details link always present on failure.      |
| **#8 Aesthetic and minimalist design**         | Future states rendered in low-contrast neutral; only the current and past states carry strong visual weight.                          |

---

## 10. Accessibility (WCAG 2.2 AA)

- The SVG diagram has role=img with aria-label=Workflow state machine.
- Each node group has role=graphics-symbol, aria-label with state name and status (e.g. aria-label=Executing, current state, duration 4 minutes 12 seconds).
- aria-describedby on each node points to a visually hidden desc element containing the full timing and retry detail.
- The current state node is announced via aria-live=polite in a visually hidden status region outside the SVG; this updates on state transitions.
- Keyboard navigation: Tab cycles through interactive nodes; Enter/Space opens the node detail popover; Escape closes it.
- Arrow labels are aria-hidden on the visual text elements; a structured textual summary of transitions is available in a Transition log table below the diagram.
- Dashed vs solid arrows are not distinguished by colour alone; line-dash pattern provides a non-colour cue; a legend is included below the diagram.
