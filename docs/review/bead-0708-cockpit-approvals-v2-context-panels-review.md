# Review: bead-0708 (Cockpit approvals v2 context panels)

Reviewed on: 2026-02-21

## Scope

- `apps/cockpit/src/components/cockpit/approval-context-panels.tsx`
- `apps/cockpit/src/components/cockpit/lib/approval-context-panels-summary.ts`
- `apps/cockpit/src/components/cockpit/lib/approval-context-panels-summary.test.ts`
- `apps/cockpit/src/components/cockpit/approval-triage-card.tsx`
- `.specify/specs/cockpit-approvals-v2-context-panels-v1.md`

## Findings

High:

- none.

Medium:

- none.

Low:

- none.

## Verification Evidence

- Confirmed triage card now renders cross-layer context panels for policy, evidence, and run timeline.
- Confirmed panel quick-jump actions route to `compliance-checklist`, `evidence-chain`, and `story-timeline` modes.
- Confirmed summary helper tests cover chain verification state, policy summary mapping, and timeline cycle/overdue semantics.
