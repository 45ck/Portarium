# Approval Flow QA Checklist

## Scope

End-to-end verification of the approval workflow: viewing a pending approval,
reviewing its provenance and evidence, and submitting an Approve / Deny /
Request-Changes decision with mandatory rationale validation.

## Prerequisites

- Cockpit dev server running: `cd apps/cockpit && npx vite`
- Demo dataset active (MSW mocks serve `demo` fixture with a `Pending` approval)
- Logged in as **Alice** (role: approver)

## Checklist

### 1 — Navigate to approvals

| #   | Step                                                                      | Pass | Fail | Notes |
| --- | ------------------------------------------------------------------------- | :--: | :--: | ----- |
| 1   | Open `/approvals` — pending approval list renders                         |  ☐   |  ☐   |       |
| 2   | Each approval card shows: title, status badge, requested-by, requested-at |  ☐   |  ☐   |       |
| 3   | `WaitingForApproval` status badge is visible and amber-coloured           |  ☐   |  ☐   |       |
| 4   | Click an approval card — detail panel opens                               |  ☐   |  ☐   |       |

### 2 — Approval detail view

| #   | Step                                                      | Pass | Fail | Notes |
| --- | --------------------------------------------------------- | :--: | :--: | ----- |
| 5   | Approval prompt is displayed prominently                  |  ☐   |  ☐   |       |
| 6   | Provenance journey section is visible ("How we got here") |  ☐   |  ☐   |       |
| 7   | Evidence timeline shows at least one entry                |  ☐   |  ☐   |       |
| 8   | Effects list (planned / verified) is visible              |  ☐   |  ☐   |       |
| 9   | Approve, Deny, and Request Changes buttons are present    |  ☐   |  ☐   |       |

### 3 — Approve action

| #   | Step                                                                                | Pass | Fail | Notes |
| --- | ----------------------------------------------------------------------------------- | :--: | :--: | ----- |
| 10  | Click **Approve** — approval succeeds without a rationale (approve is low-friction) |  ☐   |  ☐   |       |
| 11  | Status badge updates to `Approved` / `Executing` after decision                     |  ☐   |  ☐   |       |
| 12  | Decision is reflected in the approval list (card removed or status updated)         |  ☐   |  ☐   |       |

### 4 — Deny action (rationale required)

| #   | Step                                                                            | Pass | Fail | Notes |
| --- | ------------------------------------------------------------------------------- | :--: | :--: | ----- |
| 13  | Reload a fresh `Pending` approval                                               |  ☐   |  ☐   |       |
| 14  | Click **Deny** without entering a rationale — button is disabled or alert shown |  ☐   |  ☐   |       |
| 15  | Enter a rationale (≥ 10 characters) — Deny button becomes enabled               |  ☐   |  ☐   |       |
| 16  | Submit Deny — status updates to `Denied`                                        |  ☐   |  ☐   |       |

### 5 — Request Changes action

| #   | Step                                                              | Pass | Fail | Notes |
| --- | ----------------------------------------------------------------- | :--: | :--: | ----- |
| 17  | Reload a fresh `Pending` approval                                 |  ☐   |  ☐   |       |
| 18  | Click **Request Changes** — rationale field appears               |  ☐   |  ☐   |       |
| 19  | Submit without rationale — validation error shown                 |  ☐   |  ☐   |       |
| 20  | Enter rationale and submit — status updates to `ChangesRequested` |  ☐   |  ☐   |       |
| 21  | Provenance journey shows new "changes requested by Alice" entry   |  ☐   |  ☐   |       |

### 6 — SoD (Segregation of Duties) enforcement

| #   | Step                                                          | Pass | Fail | Notes |
| --- | ------------------------------------------------------------- | :--: | :--: | ----- |
| 22  | For a self-requested approval, **Approve** button is disabled |  ☐   |  ☐   |       |
| 23  | SoD banner or tooltip explains why approve is blocked         |  ☐   |  ☐   |       |

## Pass criteria

All rows must show **Pass**. Rationale validation (rows 14–16, 19) is critical path.

## Related automated tests

```
npm run -w apps/cockpit test -- src/components/cockpit/approval-gate-panel.test.tsx
npm run -w apps/cockpit test -- src/components/cockpit/approval-review-panel.test.tsx
npm run -w apps/cockpit test -- src/components/cockpit/approval-shell.test.tsx
```
