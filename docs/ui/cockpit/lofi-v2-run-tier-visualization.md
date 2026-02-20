# Cockpit Lo-Fi v2: Run Detail Execution Tier Visualization

Bead: `bead-0537`  
Scope: Visual differentiation of execution tiers in Run detail timeline.

## Wireframe Artifact

- Primary artifact: `docs/ui/cockpit/index.html` (Run detail timeline + step panel)
- Visual captures:
- `docs/ui/cockpit/screenshots/heuristic-12-run-detail-timeline.png`
- `docs/ui/cockpit/screenshots/run-detail-v3.png`
- `docs/ui/cockpit/screenshots/run-detail-improved.png`

## Annotated Tier States

- `Auto`:
- Solid success-progress styling and autonomous badge.
- `HumanApprove`:
- Paused state with approval wait panel and assignee context.
- `ManualOnly`:
- Paused state with linked human task, assigned workforce member, completion CTA.
- `Failed`:
- Error panel with recover/escalate path and evidence jump link.
- Historical completed human steps:
- Greyed timeline nodes with completion evidence pointer.
- Degraded state:
- No assignee or empty queue surfaces warning panel and retry guidance.

## Transition Diagram

- Pending -> InProgress -> Completed
- Pending -> InProgress -> Failed
- Pending -> Paused(HumanApprove) -> InProgress -> Completed/Failed
- Pending -> Paused(ManualOnly) -> InProgress -> Completed/Failed

## Nielsen Heuristics Note

- Visibility of system status: tier badges remain visible at step and timeline level.
- Match to mental model: pause reasons map directly to approval/manual workflows.
- Diagnose/recover from errors: degraded panel provides explicit next actions.

## Reviewer Sign-Off

- Reviewer: Principal Engineer (MQCKENC)
- Status: Approved for implementation
