# Portarium QA Checklists

Structured manual QA checklists for the Portarium Cockpit UI. Each checklist
targets a specific area and includes pass/fail columns for sign-off.

## Checklists

| Checklist                                               | Scope                                                              | Personas          |
| ------------------------------------------------------- | ------------------------------------------------------------------ | ----------------- |
| [UI Smoke](./ui-smoke-checklist.md)                     | All routes load, layout intact, no console errors                  | Any               |
| [Approval Flow](./approval-flow-checklist.md)           | Approve / Deny / Request Changes with rationale validation + SoD   | Alice (approver)  |
| [Run Management](./run-management-checklist.md)         | Start / cancel / retry runs, status badge colours                  | Bob (operator)    |
| [RBAC](./rbac-checklist.md)                             | Alice / Bob / Carol see correct menus, data, and actions           | Alice, Bob, Carol |
| [Responsive / Mobile](./responsive-mobile-checklist.md) | < 640 px viewport, bottom nav, filter-bar wrap                     | Any               |
| [Error Handling](./error-handling-checklist.md)         | RFC 7807 Problem Details, form validation, error boundary, offline | Any               |

## How to use

1. Open the relevant checklist.
2. Work through each row in order.
3. Mark ☑ in the **Pass** column when the step succeeds.
4. Mark ☑ in the **Fail** column and add a note when a step fails.
5. File a GitHub issue for every **Fail**, linking to this checklist and the row number.

## Existing automated coverage

Before running manual checklists, confirm automated tests pass:

```bash
# Root backend tests
npm run test

# Cockpit component tests
npm run -w apps/cockpit test

# Full CI gate
npm run ci:pr
```

## Exploratory test scripts

For scripted browser-based exploration, use `agent-browser`:

```bash
# Launch cockpit and take a snapshot of interactive elements
npm run ab -- open http://localhost:5173 --headed
npm run ab -- snapshot -i

# Capture a screenshot for evidence
npm run ab -- screenshot ./docs/qa/evidence/smoke-$(date +%Y%m%d).png

# Close browser
npm run ab -- close
```
