# Cockpit Approvals V2 Context Panels v1 (Specification)

## Purpose

Add cross-layer context inside approval triage so approvers can quickly pivot between policy posture, evidence integrity, and run chronology before deciding.

## Scope

- Approvals triage card context surface on `apps/cockpit/src/routes/approvals/index.tsx`.
- Policy, evidence, and run timeline summary panels in the triage card.
- Quick-jump controls from each panel to the related triage mode.

## Behaviour requirements

### R1 Context panel presence

- Triage card must render three context panels:
  - `Policy Context`
  - `Evidence Context`
  - `Run Timeline`
- Panels must remain visible while triaging and not require opening secondary routes.

### R2 Policy panel semantics

- Policy panel must show execution tier/policy trigger/irreversibility and current SoD state summary.
- Policy panel must expose a direct action that opens `compliance-checklist` mode.

### R3 Evidence panel semantics

- Evidence panel must show entry count, attachment count, and chain state (`none`, `verified`, `broken`).
- Evidence panel must expose latest evidence time when entries exist.
- Evidence panel must expose a direct action that opens `evidence-chain` mode.

### R4 Timeline panel semantics

- Timeline panel must show current run status and execution tier.
- Timeline panel must summarize approval revision cycle count from decision history.
- Timeline panel must show due-date state, including overdue indication when due date has passed.
- Timeline panel must expose a direct action that opens `story-timeline` mode.

### R5 Responsiveness and accessibility

- Panels must stack on narrow screens and render in a multi-column layout on larger screens.
- Panel actions must be keyboard-focusable controls with visible labels.

## Acceptance criteria

1. Approvals triage displays all three context panels for a pending approval.
2. Panel quick-jump actions switch the triage mode to compliance/evidence/timeline views respectively.
3. Evidence and timeline summaries correctly reflect empty, nominal, and warning states.

## Traceability links

- `apps/cockpit/src/components/cockpit/approval-triage-card.tsx`
- `apps/cockpit/src/components/cockpit/approval-context-panels.tsx`
- `apps/cockpit/src/components/cockpit/lib/approval-context-panels-summary.ts`
- `apps/cockpit/src/components/cockpit/lib/approval-context-panels-summary.test.ts`
