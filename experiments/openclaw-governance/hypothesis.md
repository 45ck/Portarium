# Hypothesis

<!-- Tag: bead-0959, bead-0960, bead-0961, bead-0977 -->

## Statement

A tool call intercepted by the `openclaw-plugin` is blocked for human approval and the agent is
unblocked exactly when the operator approves it via the Portarium control plane.

## Rationale

The `registerBeforeToolCallHook` handler in `packages/openclaw-plugin/src/hooks/before-tool-call.ts`
calls `client.proposeAction(...)` for every non-bypassed tool call. When the Portarium control plane
returns `{ decision: 'NeedsApproval', approvalId }`, the hook delegates to `ApprovalPoller`, which
polls `GET .../approvals/:approvalId` until the status transitions to `approved` or `denied`.

This experiment validates the full loop end-to-end against a live Portarium control plane instance:

1. The proposal POST produces a `NeedsApproval` decision (because `send_email` is in the
   `HumanApprove` capability tier by default).
2. The approval record is immediately queryable and its status is `pending`.
3. After an operator calls `POST .../approvals/:approvalId/decide` with `decision: 'Approved'`, the
   poller unblocks within one poll cycle and returns `{ approved: true }`.

## Success criteria

- [ ] `POST /agent-actions:propose` returns `decision: NeedsApproval` with a non-empty `approvalId`
- [ ] `GET /approvals/:approvalId` returns `status: pending` immediately after proposal
- [ ] `POST /approvals/:approvalId/decide` with `Approved` returns `status: 200`
- [ ] `ApprovalPoller.waitForDecision(approvalId)` resolves to `{ approved: true }` after operator decision
- [ ] The outcome written to `results/outcome.json` is `confirmed`
