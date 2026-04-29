# Bead Thread Events v1

**Bead:** bead-0975
**Status:** Implemented

## Scope

Portarium exposes a bead-scoped live event stream so Cockpit can show the current tool-call and approval thread for one Bead without polling the full workspace event feed.

## Contract

- `GET /v1/workspaces/:workspaceId/beads/:beadId/events` returns `text/event-stream`.
- The endpoint uses the same authentication and workspace scoping as `GET /v1/workspaces/:workspaceId/events:stream`.
- If the deployment has no event stream broadcaster configured, the endpoint returns `503`.
- Events are streamed only when the event payload contains the requested Bead ID at `beadId`, `bead.beadId`, `metadata.beadId`, or `parameters.beadId`/`parameters.metadata.beadId`.
- SSE frames use the workspace stream format: `event`, `id`, and JSON `data`.

## Agent Approval Bridge

When `POST /v1/workspaces/:workspaceId/agent-actions:propose` returns `NeedsApproval` and the runtime has an event stream broadcaster, the control plane publishes `com.portarium.approval.ApprovalRequested`.

The event data includes the proposal response plus review context:

- `approvalId`
- `proposalId`
- `agentId`
- `machineId` when provided
- `toolName`
- `actionKind`
- `executionTier`
- `policyIds`
- `rationale`
- `parameters`
- `beadId` when present in parameters or metadata

## Cockpit Behavior

- `useBeadThreadStream(workspaceId, beadId)` hydrates any available snapshot from `/thread`, then connects to `/events`.
- Live events are normalized into tool-call entries with policy tier, blast radius, status, arguments, and approval metadata.
- `BeadThreadPanel` renders a mobile-friendly thread, highlights entries awaiting approval, and exposes a review action for approval gate entries.
