# Spec: Cockpit Mobile Offline Baseline v1

## Scope

Bead: `bead-0718`

Add baseline offline support for mobile cockpit usage:

- Cached reads for core lists: Approvals, Work Items, Runs.
- Explicit stale/offline UX with last-sync metadata.
- Safe offline mutation outbox for approval decisions with replay on reconnect.
- Mobile-tuned retry/backoff for transient network transitions.
- Push/deep-link readiness for pending approval review when a user is away from desktop.

## Behavioral Contract

1. Core list read caching

- The cockpit persists the latest successful payload for:
  - `GET /v1/workspaces/{workspaceId}/approvals`
  - `GET /v1/workspaces/{workspaceId}/work-items`
  - `GET /v1/workspaces/{workspaceId}/runs`
- Cached payloads include a `cachedAt` timestamp and are used as initial query data on load.

2. Stale/offline state visibility

- Runs, Work Items, and Approvals pages show an explicit stale/offline banner when:
  - browser is offline, or
  - current data age exceeds stale threshold.
- Banner includes last-sync age and queued mutation count where relevant.

3. Offline approval outbox

- Approval decisions attempted while offline (or during network transport failure) are queued in local storage.
- Queue entries use deterministic idempotency keys to deduplicate identical decisions.
- On reconnect, queued decisions replay in order; successful and conflict (`409`) entries are removed.

4. Retry/backoff

- Core list queries use offline-first network mode with bounded exponential retry delay.

5. Approval notification and deep-link readiness

- Push registration, when enabled, must route pending approval notifications to the focused approval view.
- Notification click handling must preserve workspace and approval identity.
- If realtime approval events degrade, the UI must show stale state and fall back to polling.

## Validation

- Unit tests cover offline cache envelope behavior.
- Unit tests cover outbox dedupe and replay semantics including conflict handling.
- Tests or QA evidence cover approval deep-linking and mobile offline/reconnect review.
- `npm run ci:pr` passes.
