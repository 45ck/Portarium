# Cockpit Triage Card Notes

This folder owns the Cockpit triage-card presentation layer for Approval Gate
review and related operator decision surfaces.

## Approval Card Prompt Contract

`Approval.prompt` is treated as the compact decision label. It should identify
the action and target that need a human decision, not carry full review prose,
packet markdown, policy rationale, evidence dumps, logs, or execution plans.

When upstream systems send verbose approval prompts, the card contract should
summarize them before they reach the header or repeated top-level fields. The
longer context should stay in the review-depth surface:

- `PROPOSED ACTION`
- `GOAL OR INTENT`
- systems, policy, blast-radius, reversibility, evidence, and rationale fields
- `ApprovalPacket` detail, including plan scope, requested capabilities, and
  review docs

This keeps the top card useful for queue scanning and mobile review while still
preserving the complete packet for deeper review.

## Implementation Map

- `approval-card-contract.ts` derives the semantic review fields and compact
  approval summaries.
- `triage-card-header.tsx` renders the compact title and card metadata.
- `triage-default-content.tsx` renders review-depth fields and packet detail.
- `approval-triage-card.tsx` wires Approval Gate data into the generic triage
  card shell.

Approval rendering does not execute an action. Execution must remain a separate
control-plane path after the approval decision and downstream idempotency,
policy, and capability checks.
