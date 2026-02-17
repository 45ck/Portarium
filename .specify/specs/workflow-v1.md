# Workflow v1 (Runbook Definition)

## Purpose

A Workflow is the durable runbook definition that Runs execute. It defines the ordered sequence of Actions, the baseline execution tier, and version metadata.

This schema is aligned with the Workflow aggregate in `docs/domain/aggregates.md`.

## Schema (WorkflowV1)

Fields:

- `schemaVersion`: `1`
- `workflowId`: branded `WorkflowId`
- `workspaceId`: branded `WorkspaceId`
- `name`: non-empty string
- `description?`: optional string
- `version`: integer `>= 1`
- `active`: boolean
- `executionTier`: `ExecutionTier`
- `actions`: `WorkflowActionV1[]` (non-empty; ordered; contiguous `order` values)

### WorkflowActionV1

- `actionId`: branded `ActionId`
- `order`: integer `>= 1` (must be contiguous starting at 1)
- `portFamily`: `PortFamily`
- `operation`: non-empty string (provider/adapter operation key)
- `executionTierOverride?`: optional `ExecutionTier` (may be stricter than the workflow tier, but not less strict)
