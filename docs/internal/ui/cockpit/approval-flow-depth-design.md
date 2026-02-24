# UX Design: Approval Flow Depth

**Bead:** bead-0458
**Status:** Done
**Date:** 2026-02-18

## Problem

The existing approval screens handle the basic approve/deny action but lack:

1. **Decision rationale required for ALL decisions** (currently only required for deny in triage)
2. **SoD evaluation display** — showing who requested, who can approve, and whether SoD constraints apply
3. **Request-changes cycle** — sending a structured message back to the requestor with history
4. **Policy rule display** — showing which policy rule triggered this approval gate

## Approval Flow Depth Spec

### 1. ApprovalDecisionForm (domain primitive)

```
┌─ Approval Gate: Approve Plan: Create Invoice in NetSuite ─────────────┐
│  Run R-8920 | WI-1099 | Requested 12m ago by operator@acme.com        │
│                                                                        │
│  ┌─ SoD Evaluation ──────────────────────────────────────────────────┐ │
│  │ ✓ You are eligible to approve                                     │ │
│  │   Requestor: operator@acme.com (different from you)               │ │
│  │   Rule: Different-approver constraint (SoD-FINANCE-001)           │ │
│  │   Roles required: approver OR admin                               │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  ┌─ Policy Rule ─────────────────────────────────────────────────────┐ │
│  │ Rule: FINANCE-APPROVAL-001                                        │ │
│  │ Trigger: write:finance AND amount > $1,000                        │ │
│  │ Tier: Human-approve (all effects will execute on approval)        │ │
│  │ Blast radius: 1 system (NetSuite) | 1 record affected             │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  Decision rationale (required):                                        │
│  [                                              ]                      │
│                                                                        │
│  [Approve ✓]  [Deny ✗]  [Request changes ↩]                           │
└────────────────────────────────────────────────────────────────────────┘
```

### 2. SoD Evaluation States

| State                  | Visual                                                      |
| ---------------------- | ----------------------------------------------------------- |
| Eligible               | Green banner: "You are eligible to approve" + who-requested |
| Blocked (same person)  | Red banner: "You cannot approve your own request"           |
| Blocked (role missing) | Red banner: "Requires [role] — you have [current roles]"    |
| N-of-M required        | Yellow banner: "2 of 3 approvers needed — 1 more required"  |

### 3. Request-Changes Cycle

When approver selects "Request changes":

1. Message form opens: "What needs to change? (required)"
2. Optional: Attach specific plan effect to highlight
3. Submit → creates `RequestChanges` event on the approval gate
4. Requestor is notified; run stays in `PendingApproval` state
5. History panel shows cycle: Request → Changes Requested → Resubmitted → Pending

**History display:**

```
● 09:12 — Approval requested (operator@acme.com)
  ↩ 09:35 — Changes requested (approver@acme.com): "Invoice total seems off"
  ✏ 09:58 — Plan revised and resubmitted (operator@acme.com)
  ◷ Now — Pending your decision
```

### 4. Policy Rule Display

Show which rule triggered the gate:

- Rule ID (linkable to policy management)
- Trigger condition (human-readable)
- Tier (auto/assisted/human/manual)
- Blast radius (affected systems + record count)
- Irreversibility indicator (full/partial/none)

## Nielsen Heuristic Evaluation

| Heuristic                           | Assessment                                    |
| ----------------------------------- | --------------------------------------------- |
| Visibility of system status         | ✓ SoD eligibility shown before decision       |
| Match between system and real world | ✓ Policy shown in business language           |
| Error prevention                    | ✓ SoD blocked state disables approve button   |
| Flexibility and efficiency          | ✓ Keyboard shortcuts in triage view           |
| Recognition over recall             | ✓ Policy rule display, blast-radius chips     |
| Help and documentation              | ✓ Request-changes cycle with history trail    |
| User control and freedom            | ✓ Cancel request-changes before submitting    |
| Consistency                         | ✓ Rationale field reused across all decisions |

## Accessibility

- SoD banner uses `role="alert"` when blocked (screen reader announces immediately)
- Decision buttons group: `role="group"` with `aria-label="Make approval decision"`
- Rationale textarea: `aria-required="true"`, labelled with gate name context
- Request-changes form: focus moved to message field on open
- History items: time elements use `<time datetime="...">` for screen readers
