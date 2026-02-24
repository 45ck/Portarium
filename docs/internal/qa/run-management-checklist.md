# Run Management QA Checklist

## Scope

Verify that workflow runs can be viewed, started, cancelled, and retried through
the Cockpit UI, and that status transitions are reflected correctly.

## Prerequisites

- Cockpit dev server running: `cd apps/cockpit && npx vite`
- Demo dataset active (MSW mocks serve runs in various states)
- Logged in as **Bob** (role: operator)

## Checklist

### 1 — Run list

| #   | Step                                                                 | Pass | Fail | Notes |
| --- | -------------------------------------------------------------------- | :--: | :--: | ----- |
| 1   | Open `/runs` — run list renders                                      |  ☐   |  ☐   |       |
| 2   | Each run card shows: run ID, workflow name, status badge, created-at |  ☐   |  ☐   |       |
| 3   | Status badges display correct colour for each state:                 |      |      |       |
|     | • `Pending` — grey secondary                                         |  ☐   |  ☐   |       |
|     | • `Running` — blue info                                              |  ☐   |  ☐   |       |
|     | • `WaitingForApproval` — amber outline                               |  ☐   |  ☐   |       |
|     | • `Succeeded` — green success                                        |  ☐   |  ☐   |       |
|     | • `Failed` — red destructive                                         |  ☐   |  ☐   |       |
|     | • `Cancelled` — grey secondary                                       |  ☐   |  ☐   |       |
| 4   | Filter bar allows filtering by status                                |  ☐   |  ☐   |       |
| 5   | Search/filter by run ID or workflow name works                       |  ☐   |  ☐   |       |

### 2 — Run detail

| #   | Step                                                                  | Pass | Fail | Notes |
| --- | --------------------------------------------------------------------- | :--: | :--: | ----- |
| 6   | Click a run row — detail view loads at `/runs/:runId`                 |  ☐   |  ☐   |       |
| 7   | Run detail shows: run ID, workflow, status, execution tier, initiator |  ☐   |  ☐   |       |
| 8   | Evidence timeline in run detail shows at least one entry              |  ☐   |  ☐   |       |
| 9   | Effects list (planned / verified) is visible                          |  ☐   |  ☐   |       |

### 3 — Start a run

| #   | Step                                                                          | Pass | Fail | Notes |
| --- | ----------------------------------------------------------------------------- | :--: | :--: | ----- |
| 10  | Navigate to `/workflows`                                                      |  ☐   |  ☐   |       |
| 11  | Click **Start Run** on a workflow — dialog opens                              |  ☐   |  ☐   |       |
| 12  | Confirm start — new run appears in `/runs` with `Pending` or `Running` status |  ☐   |  ☐   |       |

### 4 — Cancel a run

| #   | Step                                                            | Pass | Fail | Notes |
| --- | --------------------------------------------------------------- | :--: | :--: | ----- |
| 13  | Open a `Running` or `Pending` run detail                        |  ☐   |  ☐   |       |
| 14  | Click **Cancel** — confirmation dialog appears                  |  ☐   |  ☐   |       |
| 15  | Confirm cancel — run status updates to `Cancelled`              |  ☐   |  ☐   |       |
| 16  | Cancelled run is no longer actionable (no Cancel/Retry buttons) |  ☐   |  ☐   |       |

### 5 — Retry a failed run

| #   | Step                                                     | Pass | Fail | Notes |
| --- | -------------------------------------------------------- | :--: | :--: | ----- |
| 17  | Open a `Failed` run detail                               |  ☐   |  ☐   |       |
| 18  | Retry button is visible and enabled                      |  ☐   |  ☐   |       |
| 19  | Click **Retry** — new run created and linked to original |  ☐   |  ☐   |       |
| 20  | New run status is `Pending` or `Running`                 |  ☐   |  ☐   |       |

### 6 — Execution tier display

| #   | Step                                     | Pass | Fail | Notes |
| --- | ---------------------------------------- | :--: | :--: | ----- |
| 21  | `Auto` tier badge shown in teal/green    |  ☐   |  ☐   |       |
| 22  | `Assisted` tier badge shown in blue      |  ☐   |  ☐   |       |
| 23  | `HumanApprove` tier badge shown in amber |  ☐   |  ☐   |       |
| 24  | `ManualOnly` tier badge shown in red     |  ☐   |  ☐   |       |

## Pass criteria

All rows must show **Pass**. Status badge colouring (row 3) is critical for
operator situational awareness.

## Related automated tests

```
npm run -w apps/cockpit test -- src/components/cockpit/run-status-badge.test.tsx
```
