# Cockpit Lo-Fi v2: Work Item Owner Assignment

Bead: `bead-0536`  
Scope: Work Item owner assignment UX using workforce picker.

## Wireframe Artifact

- Primary artifact: `docs/ui/cockpit/index.html` (Work Item detail/list assignment states)
- Visual captures:
- `docs/ui/cockpit/screenshots/heuristic-08-work-items.png`
- `docs/ui/cockpit/screenshots/heuristic-09-work-item-detail.png`
- `docs/ui/cockpit/screenshots/heuristic-10-owner-picker-open.png`

## Annotated States

- Current owner chip:
- Shows owner identity, quick unassign action, and availability signal.
- Picker open:
- Typeahead by name/capability/queue with keyboard navigation and selection preview.
- Confirmation:
- Explicit assignment confirmation on destructive owner replacement.
- Assignment history:
- Append-only timeline aligned to evidence posture (`who`, `when`, `from`, `to`).
- Bulk assign:
- Work Items list multi-select action with same picker component.

## Accessibility Notes

- Picker is fully keyboard-navigable:
- Arrow keys for options, `Enter` to select, `Esc` to close, focus-return to trigger.
- Chip and history controls meet WCAG 2.2 AA contrast and focus visibility.

## Nielsen Heuristics Note

- Error prevention: explicit confirmation on owner change.
- Consistency: picker interactions match existing assignment patterns.
- Visibility: history timeline keeps assignment changes auditable.

## Reviewer Sign-Off

- Reviewer: Principal Engineer (MQCKENC)
- Status: Approved for implementation

