# Cockpit Workflows Route v1

## Purpose

Add a dedicated workflow browse/inspect surface to the cockpit so `workflowId` references in runs are navigable domain entities.

## Scope

- Route: `/workflows`
- Route: `/workflows/:workflowId`
- Navigation: add **Workflows** under the **Work** section.
- Linkage:
  - `/runs` workflow column links to `/workflows/:workflowId`
  - Dashboard active-runs workflow column links to `/workflows/:workflowId`

## Behaviour

### `/workflows` list

- Displays workflow definitions with:
  - `workflowId`
  - `name`
  - `version`
  - `triggerKind`
  - `executionTier`
  - `actionCount`
  - active/inactive status
  - linked-runs count
- Supports status and trigger filters.

### `/workflows/:workflowId` detail

- Shows:
  - version history panel
  - trigger configuration panel
  - execution policy panel (tier/timeout/retry/compensation)
  - action step list
  - linked-runs table with links to `/runs/:runId`

## Data contract

- Read from control-plane endpoints:
  - `GET /v1/workspaces/{workspaceId}/workflows`
  - `GET /v1/workspaces/{workspaceId}/workflows/{workflowId}`
- In mock/dev mode, workflow payloads are generated from fixture runs + agents for deterministic navigation and page-load testing.
