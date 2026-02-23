# Error Handling QA Checklist

## Scope

Verify that the Cockpit surfaces errors correctly: RFC 7807 Problem Details from
the API are translated into user-visible alerts, form validation errors are shown
inline, and unexpected component errors are caught by the error boundary.

## Prerequisites

- Cockpit dev server running: `cd apps/cockpit && npx vite`
- MSW mock handlers active
- Ability to override mock responses to return error payloads (edit
  `apps/cockpit/src/mocks/handlers.ts` temporarily or use the MSW DevTools)

---

## Checklist

### RFC 7807 Problem Details — API errors

| #   | Step                                                                                       | Pass | Fail | Notes |
| --- | ------------------------------------------------------------------------------------------ | :--: | :--: | ----- |
| 1   | Override GET `/approvals` to return `400 Bad Request` with `application/problem+json` body |  ☐   |  ☐   |       |
| 2   | Approvals page shows an error banner (not a blank/crash)                                   |  ☐   |  ☐   |       |
| 3   | Error banner contains a human-readable title and detail                                    |  ☐   |  ☐   |       |
| 4   | Override GET `/runs` to return `500 Internal Server Error`                                 |  ☐   |  ☐   |       |
| 5   | Runs page shows an error state with a retry button                                         |  ☐   |  ☐   |       |
| 6   | Clicking retry re-fetches the data                                                         |  ☐   |  ☐   |       |
| 7   | Override POST (approval decision) to return `409 Conflict`                                 |  ☐   |  ☐   |       |
| 8   | Conflict error message is shown inline in the decision form                                |  ☐   |  ☐   |       |

### Form validation errors

| #   | Step                                                                                 | Pass | Fail | Notes |
| --- | ------------------------------------------------------------------------------------ | :--: | :--: | ----- |
| 9   | On the Deny form, submit without rationale — inline validation error appears         |  ☐   |  ☐   |       |
| 10  | Validation error text is readable and describes the rule (e.g. "Rationale required") |  ☐   |  ☐   |       |
| 11  | On the Request Changes form, submit with a 2-char rationale — min-length error shown |  ☐   |  ☐   |       |
| 12  | On the Start Run dialog, submit with missing required fields — error shown per field |  ☐   |  ☐   |       |
| 13  | Correcting a validation error clears the error message immediately                   |  ☐   |  ☐   |       |

### Error boundary (unhandled component crashes)

| #   | Step                                                                               | Pass | Fail | Notes |
| --- | ---------------------------------------------------------------------------------- | :--: | :--: | ----- |
| 14  | Temporarily throw an error in a child component; page shows "Something went wrong" |  ☐   |  ☐   |       |
| 15  | Error message from the thrown error is visible                                     |  ☐   |  ☐   |       |
| 16  | "Reload page" button is present and functional                                     |  ☐   |  ☐   |       |
| 17  | After reload, the page recovers normally                                           |  ☐   |  ☐   |       |
| 18  | Custom fallback UI appears when `fallback` prop is provided to `ErrorBoundary`     |  ☐   |  ☐   |       |

### Network / offline state

| #   | Step                                                          | Pass | Fail | Notes |
| --- | ------------------------------------------------------------- | :--: | :--: | ----- |
| 19  | Enable DevTools network throttle (Offline mode)               |  ☐   |  ☐   |       |
| 20  | Offline sync banner appears at the top of the page            |  ☐   |  ☐   |       |
| 21  | Data that was previously loaded remains visible (stale cache) |  ☐   |  ☐   |       |
| 22  | Re-enabling network hides the offline banner                  |  ☐   |  ☐   |       |

### Chain integrity

| #   | Step                                                        | Pass | Fail | Notes |
| --- | ----------------------------------------------------------- | :--: | :--: | ----- |
| 23  | Override evidence endpoint to return a broken hash chain    |  ☐   |  ☐   |       |
| 24  | Chain integrity banner appears with a warning               |  ☐   |  ☐   |       |
| 25  | Banner is dismissible and does not block the rest of the UI |  ☐   |  ☐   |       |

## Pass criteria

All rows must show **Pass**. Rows 1–8 (API errors) and 9–13 (form validation)
are critical path.

## Related automated tests

```
npm run -w apps/cockpit test -- src/components/cockpit/error-boundary.test.tsx
npm run -w apps/cockpit test -- src/components/cockpit/approval-gate-panel.test.tsx
npm run -w apps/cockpit test -- src/components/cockpit/approval-review-panel.test.tsx
```
