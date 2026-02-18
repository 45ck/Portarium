# UX Design: Robots / Fleet Screen

**Bead:** bead-0525
**Status:** Done
**Date:** 2026-02-18

## Problem

Operators and safety administrators need to monitor the health, connectivity, and state of the entire robot fleet. Currently there is no unified view for robot enrolment, real-time health badges, or per-robot E-Stop controls. Operators lack a quick way to spot degraded robots and intervene; safety admins cannot efficiently clear E-Stop states without hunting through logs.

## Goals

1. Surface fleet health at a glance (stat tiles: Total / Online / Degraded / E-Stopped).
2. Provide robot card grid with class-filter chips (All / AMR / AGV / Manipulator / UAV / PLC).
3. Allow operators to test connectivity and open a per-robot detail slide-over.
4. Gate E-Stop clear behind safety_admin persona.

## Information Architecture

```
Sidebar: Robotics > Robots
  → Robots screen (fleet grid)
      → Robot detail (slide-over drawer)
          → Send E-Stop / Clear E-Stop (role-gated CTAs)
```

## Screen Layout

```
Robots
  ──────────────────────────────────────
  [48 Total]  [42 Online]  [4 Degraded]  [2 E-Stopped]

  Filter: [All ●] [AMR] [AGV] [Manipulator] [UAV] [PLC]

  ┌─────────────────────────────────┐  ┌───────────────────────────┐
  │ robot-001  [AMR]  ● Online     │  │ robot-007  [UAV]  ⚠ Deg.  │
  │ Last hb: 2s  Battery: 87%      │  │ Last hb: 45s  Bat: 12%    │
  │ Mission: nav-mission-0094      │  │ Mission: none              │
  │ [Test ↺]  [Detail →]           │  │ [Test ↺]  [Detail →]      │
  └─────────────────────────────────┘  └───────────────────────────┘

  Detail slide-over (drawer pattern):
    Identity: Robot ID | Class | SPIFFE SVID | Gateway URL
    Telemetry sparklines: battery%, speed, joint state (stubs)
    Capabilities matrix (chip list)
    Used-by missions (expandable list)
    [Send E-Stop] (operator / admin) | [Clear E-Stop] (admin only)
```

## Robot Card States

| State     | Visual                                 |
| --------- | -------------------------------------- |
| Online    | Green status dot + heartbeat age badge |
| Degraded  | Yellow ⚠ badge + last heartbeat > 30s  |
| E-Stopped | Red ⊘ badge + greyed mission field     |
| Offline   | Grey dot + heartbeat age > 5 min       |

## Detail Slide-Over

When [Detail →] is clicked:

- Identity section: Robot ID, class, SPIFFE SVID, gateway URL
- Telemetry sparklines (stubs): battery%, speed (m/s), joint state
- Capability list (chip group from capability allowlist)
- Used-by missions: expandable list of mission IDs with status
- Role-gated CTAs:
  - [Send E-Stop] — operator and admin personas
  - [Clear E-Stop] — admin persona only; requires rationale on confirm

## Nielsen Heuristic Evaluation

| Heuristic                                | Assessment                                              | Issue                    |
| ---------------------------------------- | ------------------------------------------------------- | ------------------------ |
| Visibility of system status              | ✓ Stat tiles + status chip on every card                |                          |
| Match between system and real world      | ✓ Robot class names match industry standard (AMR/AGV)   |                          |
| User control and freedom                 | ✓ Test ↺ and Cancel at every step                       |                          |
| Consistency and standards                | ✓ Reuses .card and .status chip patterns                |                          |
| Error prevention                         | ⚠ Confirm modal required for E-Stop; Clear needs reason | Implemented in wireframe |
| Recognition over recall                  | ✓ Class filter chips visible without search             |                          |
| Flexibility and efficiency               | ✓ Keyboard chord g+r navigates directly                 |                          |
| Aesthetic and minimalist design          | ✓ Card grid, no wall of text                            |                          |
| Help users recognize/recover from errors | ⚠ Heartbeat age badge warns before degraded threshold   | 30s amber, 300s red      |
| Help and documentation                   | ✓ Used-by missions gives context for E-Stop decisions   |                          |

## Accessibility

- Robot cards are `<article>` with `aria-label`
- Status badges use `aria-label` (not colour alone)
- E-Stop button labelled per-robot: "Send E-Stop to robot-001"
- Clear E-Stop button visible only to admin persona (RBAC-gated via data-requires-persona)
- Keyboard: `j`/`k` to navigate cards, `e` to trigger E-Stop on selected robot
- Skip link to filter chips

## RBAC Summary

| Persona  | View fleet | Test connection | Send E-Stop | Clear E-Stop |
| -------- | ---------- | --------------- | ----------- | ------------ |
| auditor  | ✓          | ✗               | ✗           | ✗            |
| operator | ✓          | ✓               | ✓           | ✗            |
| admin    | ✓          | ✓               | ✓           | ✓            |

## Empty State

"No robots enrolled. Enrol your first robot to start dispatching missions."
CTA: [Enrol robot]
