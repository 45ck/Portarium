# Cockpit Approvals V2 Usability and Visual QA Hardening v1

## Purpose

Harden the approvals v2 triage experience for release-quality operator use by improving queue navigation predictability, desktop information density, and QA-observable behavior.

## Scope

- Approvals route triage queue behavior and selection.
- Desktop triage layout wiring with a dedicated approval queue panel.
- Deterministic next-item and undo selection behavior.

## Behaviour requirements

### R1 Queue navigation usability

- Users must be able to select a pending approval from a visible queue list on desktop layouts.
- Active triage card must always correspond to the selected queue item.
- If the selected approval leaves the queue (decision or skip), focus must move to an adjacent item automatically.

### R2 Undo and state consistency

- Undoing a pending decision must restore the approval to the queue and restore selection to that approval.
- Progress metadata (queue index and action history slot) must remain deterministic and not depend on implicit first-item assumptions.

### R3 Visual QA layout baseline

- Desktop approvals page must present two coordinated surfaces:
  - queue list panel
  - active triage card
- Mobile/narrow layout may remain single-column triage-first.

## Acceptance criteria

1. Desktop users can pick any pending approval from the list panel and triage that specific card.
2. Decision/skip transitions move selection predictably and never leave the triage view without an active item when queue is non-empty.
3. Undo restores the affected approval as the active selection.

## Traceability links

- `apps/cockpit/src/routes/approvals/index.tsx`
- `apps/cockpit/src/components/cockpit/approval-list-panel.tsx`
