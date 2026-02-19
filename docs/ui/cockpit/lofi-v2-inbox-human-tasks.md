# Cockpit Lo-Fi v2: Inbox Human Task Queue

Bead: `bead-0535`  
Scope: Human-task queue as first-class Inbox surface.

## Wireframe Artifact

- Primary artifact: `docs/ui/cockpit/index.html` (Inbox filters + cards)
- Visual captures:
- `docs/ui/cockpit/screenshots/heuristic-01-inbox-operator.png`
- `docs/ui/cockpit/screenshots/heuristic-02-inbox-approver.png`
- `docs/ui/cockpit/screenshots/heuristic-17-inbox-human-tasks-chip.png`

## Annotated States

- Queue list (pending/in-progress/completed):
- Card fields: assignee/group chip, step context, due indicator, run/work-item links.
- Task detail drawer:
- Description, run context inputs, `Complete` and `Escalate` CTAs.
- Bulk assign/re-assign:
- Multi-select row pattern aligns with existing approval triage table.
- Empty/degraded:
- Empty state guidance plus degraded stale-data banner when queue feed fails.

## Placement Rationale

- Chosen surface: Inbox (not separate nav item).
- Reason: Human tasks are operational interruptions equivalent to approvals and failed runs.

## Nielsen Heuristics Note

- Recognition over recall: filter chips (`Assigned to me`, `Unassigned tasks`) always visible.
- Flexibility and efficiency: bulk actions reduce repeated assignment work.
- Help users recover: degraded state communicates staleness and retry path.

## Reviewer Sign-Off

- Reviewer: Principal Engineer (MQCKENC)
- Status: Approved for implementation (`bead-0546`)

