# UX Design: Safety & E-Stop Screen

**Bead:** bead-0533
**Status:** Done
**Date:** 2026-02-18

## Problem

Safety administrators need a dedicated control surface to activate global E-Stop, manage per-site constraints, review approval policy thresholds, and audit historical E-Stop events. Currently these controls are scattered or absent. A poorly designed E-Stop UI risks both accidental activation and delayed response in genuine emergencies.

## Goals

1. Global E-Stop button — visually dominant, confirm modal, immediate effect, audit-logged.
2. Per-site safety constraints table — enforcement mode (block/warn/log), safety_admin-gated edits.
3. Approval policy thresholds — read-only for most, admin-editable.
4. E-Stop audit log — last 5 events, actor, robot, timestamp, rationale.

## Information Architecture

```
Sidebar: Robotics > Safety
  → Safety screen
      → Global E-Stop button (header CTA) → confirm modal → system banner
      → Per-site constraints table → [Edit] → constraint edit form
      → Approval policy thresholds table
      → E-Stop audit log (last 5 entries)
      → [Clear E-Stop] (per-robot, admin only) → rationale confirm
```

## Screen Layout

```
Safety & E-Stop                              [⚠ Global E-Stop]  ← header, danger red

  ┌───────────────────────────────────────────────────────────┐
  │  ● System NOMINAL — 0 robots in E-Stop state              │
  └───────────────────────────────────────────────────────────┘

  Per-Site Constraints
  Site          Constraint              Enforcement   Robots  Action
  warehouse-a   max_speed ≤ 0.5 m/s    block         12      [Edit]
  bay-3         no_lift_zone            warn           4      [Edit]
  yard          outdoor_uav_permit req  block          6      [Edit]
  [+ Add Constraint]  (admin only)

  Approval Policy Thresholds
  Action Class       Tier             Notes
  navigate_to        Auto             Normal environments
  outdoor_flight     HumanApprove     Requires safety_admin sign-off
  pick (>10kg)       HumanApprove     Weight threshold gate

  E-Stop Audit Log (last 5)
  Timestamp            Actor           Robot      Event    Detail
  2026-02-18 14:01    operator@acme   robot-007  Sent     reason: low battery drift
  2026-02-18 13:55    safety_admin    robot-007  Cleared  rationale: charged + verified

  Global E-Stop flow:
    Click [⚠ Global E-Stop]
    → Confirm modal: "ALL robots will be immediately halted. This is logged."
    → On confirm: status banner turns red — "⚠ GLOBAL E-Stop ACTIVE"
    → Clear: admin only → rationale textarea required → confirm
```

## Safety Constraint States

| Enforcement | Visual             | Behaviour                      |
| ----------- | ------------------ | ------------------------------ |
| block       | Red — block chip   | Mission rejected at dispatch   |
| warn        | Yellow — warn chip | Warning shown; mission allowed |
| log         | Grey — log chip    | Event logged only              |

## Nielsen Heuristic Evaluation

| Heuristic                                | Assessment                                                      | Issue                   |
| ---------------------------------------- | --------------------------------------------------------------- | ----------------------- |
| Visibility of system status (H1)         | ✓ System NOMINAL banner always visible; turns red on E-Stop     | Primary focus of design |
| Match between system and real world      | ✓ Constraint names match physical zone descriptions             |                         |
| User control and freedom                 | ✓ Cancel on every modal; E-Stop clear always possible for admin |                         |
| Consistency and standards                | ✓ Reuses banner, table, confirm modal patterns                  |                         |
| Error prevention (H5)                    | ✓ Global E-Stop requires two-step confirm modal                 | Key safety requirement  |
| Recognition over recall                  | ✓ Enforcement badges colour-coded by severity                   |                         |
| Flexibility and efficiency               | ✓ Keyboard chord g+y; global E-Stop always in header            |                         |
| Aesthetic and minimalist design          | ✓ Danger red reserved for E-Stop CTA only                       |                         |
| Help users recognize/recover from errors | ✓ Clear E-Stop requires rationale; logged in audit table        |                         |
| Help and documentation                   | ✓ Audit log provides historical context for decisions           |                         |

## Accessibility

- Global E-Stop button has `aria-label="Activate global E-Stop for all robots"`
- System status banner uses `role="status"` for live region
- Enforcement chips use `aria-label` (not colour alone)
- Edit constraint button labelled per-site: "Edit constraint for warehouse-a"
- Admin-only CTAs hidden from non-admin personas via `data-requires-persona`
- Focus returns to trigger element after modal dismiss

## RBAC Summary

| Persona  | View safety screen | Send E-Stop | Clear E-Stop | Edit constraints | Add constraint |
| -------- | ------------------ | ----------- | ------------ | ---------------- | -------------- |
| auditor  | ✓ (audit log only) | ✗           | ✗            | ✗                | ✗              |
| operator | ✓                  | ✓           | ✗            | ✗                | ✗              |
| admin    | ✓                  | ✓           | ✓            | ✓                | ✓              |
