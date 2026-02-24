# RBAC (Role-Based Access Control) QA Checklist

## Scope

Verify that the three demo user personas see the correct menus, data, and actions
according to their assigned roles.

## Personas

| Persona   | Role       | Expected Access                                                  |
| --------- | ---------- | ---------------------------------------------------------------- |
| **Alice** | `approver` | Inbox, Approvals, Work Items, Evidence (read), Runs (read)       |
| **Bob**   | `operator` | Runs (full), Workflows (full), Workforce, Robotics, Config       |
| **Carol** | `auditor`  | Evidence (full), Governance, Explore — read-only everywhere else |

## Prerequisites

- Cockpit dev server running with MSW mocks
- Ability to switch user context via the auth store or mock handler
  (toggle `AUTH_USER` in `apps/cockpit/src/mocks/handlers.ts` or browser
  storage key `portarium:auth:user`)

---

## Alice (approver)

| #   | Step                                                          | Pass | Fail | Notes |
| --- | ------------------------------------------------------------- | :--: | :--: | ----- |
| 1   | Log in as Alice                                               |  ☐   |  ☐   |       |
| 2   | Inbox visible in sidebar — pending approval count badge shown |  ☐   |  ☐   |       |
| 3   | Approvals page accessible — can open and decide on approvals  |  ☐   |  ☐   |       |
| 4   | Work Items page accessible — can view work items              |  ☐   |  ☐   |       |
| 5   | Evidence page accessible — read-only (no delete controls)     |  ☐   |  ☐   |       |
| 6   | Config / agent management NOT accessible (hidden or 403)      |  ☐   |  ☐   |       |
| 7   | Run cancellation/retry NOT available (no buttons visible)     |  ☐   |  ☐   |       |

---

## Bob (operator)

| #   | Step                                                               | Pass | Fail | Notes |
| --- | ------------------------------------------------------------------ | :--: | :--: | ----- |
| 8   | Log in as Bob                                                      |  ☐   |  ☐   |       |
| 9   | Runs page accessible — can start, cancel, and retry runs           |  ☐   |  ☐   |       |
| 10  | Workflows page accessible — can edit and activate workflows        |  ☐   |  ☐   |       |
| 11  | Workforce page accessible — can view and assign tasks              |  ☐   |  ☐   |       |
| 12  | Robotics page accessible — can view robots and missions            |  ☐   |  ☐   |       |
| 13  | Config pages accessible — can register agents and adapters         |  ☐   |  ☐   |       |
| 14  | Approvals page NOT accessible (hidden or empty — no approver role) |  ☐   |  ☐   |       |
| 15  | Inbox has no pending approval items                                |  ☐   |  ☐   |       |

---

## Carol (auditor)

| #   | Step                                                             | Pass | Fail | Notes |
| --- | ---------------------------------------------------------------- | :--: | :--: | ----- |
| 16  | Log in as Carol                                                  |  ☐   |  ☐   |       |
| 17  | Evidence page accessible — full evidence chain visible           |  ☐   |  ☐   |       |
| 18  | Governance / Explore page accessible — compliance data visible   |  ☐   |  ☐   |       |
| 19  | Runs page accessible — read-only (no start/cancel/retry buttons) |  ☐   |  ☐   |       |
| 20  | Approvals page NOT accessible                                    |  ☐   |  ☐   |       |
| 21  | Config / agent management NOT accessible                         |  ☐   |  ☐   |       |
| 22  | Workforce task assignment NOT available                          |  ☐   |  ☐   |       |

---

## Cross-role checks

| #   | Step                                                                       | Pass | Fail | Notes |
| --- | -------------------------------------------------------------------------- | :--: | :--: | ----- |
| 23  | Switching user context refreshes the sidebar menu immediately              |  ☐   |  ☐   |       |
| 24  | Navigating to a forbidden route shows an error or redirects gracefully     |  ☐   |  ☐   |       |
| 25  | API calls that are forbidden return 403 and surface a user-visible message |  ☐   |  ☐   |       |

## Pass criteria

All rows for each persona must show **Pass**. Any RBAC bypass is a security
defect (P0).

## Related automated tests

```
npm run -w apps/cockpit test -- src/routes/cockpit-roles-tenants.test.tsx
```
