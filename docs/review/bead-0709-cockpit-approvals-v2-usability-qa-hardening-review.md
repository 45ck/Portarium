# Review: bead-0709 (Cockpit approvals v2 usability and visual QA hardening)

Reviewed on: 2026-02-21

## Scope

- `apps/cockpit/src/routes/approvals/index.tsx`
- `apps/cockpit/src/components/cockpit/approval-list-panel.tsx`
- `.specify/specs/cockpit-approvals-v2-usability-qa-hardening-v1.md`

## Findings

High:

- none.

Medium:

- none.

Low:

- none.

## Verification Evidence

- Confirmed desktop approvals route now renders a queue list panel and active triage card in a coordinated layout.
- Confirmed queue selection drives the active triage card and auto-falls forward/backward when selected items are decided/skipped.
- Confirmed undo restores queue membership and resets active selection to the undone approval.
