# Control Plane API v1 Addendum — WorkItem.kind Rollout

## Purpose

This addendum updates the Control Plane API v1 contract for the Work Item kind rollout without replacing the existing base spec.

It should be read alongside:

- `.specify/specs/control-plane-api-v1.md`
- `.specify/specs/work-item-v2.md`
- `docs/integration/work-item-kind-api-contract-alignment.md`

## Why an addendum is needed

The base v1 control-plane spec describes Work Items as universal binding objects, but it does not yet encode the first-class work taxonomy required by the updated work model.

The new work model requires:

- work to be classifiable as `case`, `change`, or `investigation`,
- Cockpit to filter and route by that classification,
- all returned Work Items to have a concrete kind,
- a compatibility path for existing `/v1` clients while the stricter contract is rolled out.

## Additive v1 changes

### List endpoint

`GET /v1/workspaces/{workspaceId}/work-items`

Add query support for:

- `kind`

Resulting supported filters become:

- `status`
- `ownerUserId`
- `kind`
- `runId`
- `workflowId`
- `approvalId`
- `evidenceId`

### Read endpoint

`GET /v1/workspaces/{workspaceId}/work-items/{workItemId}`

Returned Work Item objects must include:

- `kind`
- optional `subtype`

### Create endpoint

`POST /v1/workspaces/{workspaceId}/work-items`

Target contract:

- `title` required
- `kind` required
- `subtype` optional

Compatibility rollout for `/v1` may temporarily allow omitted `kind`, but the stored and returned object must still contain a normalized `kind`.

### Update endpoint

`PATCH /v1/workspaces/{workspaceId}/work-items/{workItemId}`

Allowed:

- title updates
- status updates
- owner updates
- subtype updates
- SLA updates
- external ref updates

Not allowed:

- `kind` mutation

## Contract invariants

1. Every returned Work Item has a concrete `kind`.
2. `kind` is one of:
   - `case`
   - `change`
   - `investigation`
3. `kind` is immutable in the public update contract.
4. Provider-specific fields still belong in external refs or evidence payloads.

## Versioning note

This addendum recommends a practical two-stage `/v1` rollout:

### Stage A — compatibility mode

- responses include `kind`
- list filtering by `kind` exists
- create accepts `kind`
- omitted `kind` may be tolerated temporarily and normalized server-side

### Stage B — strict mode

- create requires `kind` without compatibility fallback
- if strict adherence to the existing versioning policy is required, this may trigger a `/v2` cut

## Relationship to Work Item v2

The data contract described in `.specify/specs/work-item-v2.md` is the target Work Item shape for this rollout.

This addendum exists so the control-plane API spec can adopt that shape incrementally without losing the current v1 narrative and endpoint inventory.

## Implementation checklist

1. Patch OpenAPI schemas and query parameters.
2. Patch request validation.
3. Patch persistence/read normalization so `kind` is never absent in returned payloads.
4. Patch Cockpit list/detail flows to treat `kind` as source of truth.
5. Patch migration/backfill logic for historical Work Items.
