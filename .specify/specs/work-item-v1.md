# Work Item v1 (Universal Binding Object)

## Purpose

Work Items provide a thin cross-system binding object (case) that connects all artefacts involved in a single business operation without recreating Jira/Zendesk functionality.

This implements ADR-0038: Work Items as the universal binding object.

## Schema (WorkItemV1)

Fields:

- `schemaVersion`: `1`
- `workItemId`: branded `WorkItemId`
- `workspaceId`: branded `WorkspaceId`
- `createdAtIso`: ISO-8601/RFC3339 UTC timestamp string
- `createdByUserId`: branded `UserId`
- `title`: human-readable title
- `status`: `Open | Closed`
- `ownerUserId?`: optional branded `UserId`
- `sla?`: optional SLA metadata
  - `dueAtIso?`: target due timestamp (ISO string)
- `links?`: optional bindings to related artefacts
  - `externalRefs?`: `ExternalObjectRef[]` (Jira issues, Zendesk tickets, PRs, CI runs, etc.)
  - `runIds?`: `RunId[]`
  - `workflowIds?`: `WorkflowId[]`
  - `approvalIds?`: `ApprovalId[]`
  - `evidenceIds?`: `EvidenceId[]`

## Query surfaces (ADR-0038)

- `getWorkItem(workspaceId, workItemId)` returns a single binding object.
- `listWorkItems(workspaceId, filters)` supports linkage filters:
  - `runId`
  - `workflowId`
  - `approvalId`
  - `evidenceId`

## Notes

- Work Items are intentionally lightweight containers; they should not accumulate provider-specific fields.
- Provider-specific detail should be referenced via `ExternalObjectRef` and/or retention-managed evidence payloads.
