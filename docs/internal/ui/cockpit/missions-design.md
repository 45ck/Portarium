# UX Design: Missions Screen

**Bead:** bead-0532
**Status:** Done
**Date:** 2026-02-18

## Problem

Operators need to create, dispatch, monitor, and intervene on robot missions. Currently there is no dedicated missions view — operators cannot see the full ActionExecution lifecycle, cannot pre-empt running missions, and cannot link mission outcomes to the evidence chain.

## Goals

1. Show mission stat tiles (Active / Pending / Completed Today / Failed).
2. Provide Table and Kanban layout variants (A/B toggle — follows Work Items pattern).
3. Mission detail drawer with ActionExecution timeline, pre-empt/cancel, evidence link.
4. Create Mission modal: robot picker, action type, priority, reachability test, dispatch gate.

## Information Architecture

```
Sidebar: Robotics > Missions
  → Missions screen (table / kanban)
      → Mission detail drawer
          → [Pre-empt] / [Cancel] (operator role)
          → Evidence Timeline link
      → Create Mission modal
          → Robot picker → Action type → Priority → [Test Reachability] → [Dispatch]
```

## Screen Layout

```
Missions
  ──────────────────────────────────────────────
  [3 Active]  [7 Pending]  [24 Done Today]  [1 Failed]

  [+ New Mission]                 [Table | Kanban ↔]

  Table view (variant A):
  ID          Robot(s)    Goal               Status        Dispatched
  mis-0094    robot-001   Navigate to bay 3  ◉ Executing   14:02      [Pre-empt]
  mis-0095    robot-003   Pick SKU-8821       ○ Pending     —          [Cancel]
  mis-0087    robot-002   Charge station      ✓ Completed  13:41
  mis-0091    robot-005   Dock               ✗ Failed      12:55      [Retry]

  Kanban view (variant B):
  [Executing | Pending | Completed | Failed] — columns, each with mission cards

  Mission detail drawer:
    ActionExecution timeline: PENDING → DISPATCHED → EXECUTING → SUCCEEDED/FAILED/CANCELLED
    [Pre-empt] [Cancel] (operator/admin, with confirm modal)
    Evidence link → EvidenceTimeline for this mission
    Approval gate section (if ExecutionTier = HumanApprove)

  Create Mission modal:
    Robot picker (filtered by class + status=ONLINE)
    Action type: navigate_to | pick | place | dock | custom
    Priority: Low / Normal / High / Safety
    [Test Reachability] → result badge (pass/fail)
    [Dispatch] (disabled until reachability passes)
```

## Mission Status States

| Status    | Visual chip         | Terminal? |
| --------- | ------------------- | --------- |
| Pending   | ○ grey — Pending    | No        |
| Executing | ↻ blue — Executing  | No        |
| Completed | ✓ green — Completed | Yes       |
| Failed    | ✗ red — Failed      | Yes       |
| Cancelled | ⊘ red — Cancelled   | Yes       |

## Nielsen Heuristic Evaluation

| Heuristic                                | Assessment                                             | Issue                       |
| ---------------------------------------- | ------------------------------------------------------ | --------------------------- |
| Visibility of system status              | ✓ Stat tiles + status chip in table row                |                             |
| Match between system and real world      | ✓ Mission lifecycle matches physical robot operations  |                             |
| User control and freedom                 | ✓ Pre-empt / Cancel at any non-terminal state          |                             |
| Consistency and standards                | ✓ Table/Kanban toggle follows Work Items A/B pattern   |                             |
| Error prevention                         | ⚠ Dispatch disabled until reachability passes          | Implemented in create modal |
| Recognition over recall                  | ✓ Robot picker shows class + status inline             |                             |
| Flexibility and efficiency               | ✓ Keyboard chord g+m; n creates mission                |                             |
| Aesthetic and minimalist design          | ✓ Stat tiles + table; Kanban optional                  |                             |
| Help users recognize/recover from errors | ⚠ Failed mission shows Retry CTA with idempotency note |                             |
| Help and documentation                   | ✓ Evidence link on every completed/failed mission      |                             |

## Accessibility

- Mission rows are `<tr>` with keyboard navigation (j/k/Enter pattern)
- Status chips use `aria-label` (not colour alone)
- Pre-empt and Cancel buttons labelled per-mission
- Create Mission modal uses `<dialog>` with focus trap
- Dispatch button has `aria-disabled` when reachability not yet tested

## RBAC Summary

| Persona  | View missions | Create/dispatch | Pre-empt/Cancel | Retry |
| -------- | ------------- | --------------- | --------------- | ----- |
| auditor  | ✓             | ✗               | ✗               | ✗     |
| operator | ✓             | ✓               | ✓               | ✓     |
| admin    | ✓             | ✓               | ✓               | ✓     |
