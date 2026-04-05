# Work Item v2 (Kinded Universal Binding Object)

## Purpose

Extend the Work Item contract so every Work Item has a first-class **kind** while preserving the original ADR-0038 goal: a thin cross-system binding object that connects work, runs, approvals, evidence, and external artefacts without recreating Jira/Zendesk/CRM systems.

This spec is the concrete API/domain contract for the new work taxonomy introduced in:

- `docs/internal/specs/work-model-case-change-investigation.md`
- `docs/adr/0066-work-runtime-canonical-name-and-boundaries.md`

## Design Constraints

1. Work Item remains the universal governed unit of work.
2. `kind` must make work understandable without changing the governance backbone.
3. The contract should be as additive as possible to existing `/v1` APIs.
4. The model must support all three work classes:
   - `case`
   - `change`
   - `investigation`
5. `kind` must be stable enough for audit, routing, and UI layout.

## Decision Summary

Work Item v2 adds:

- required `kind`
- optional `subtype`
- list filtering by `kind`
- create-time requirement for `kind`
- immutable `kind` after creation in the public API

The Work Item remains lightweight. Provider-specific detail still belongs in external refs and evidence payloads.

## Schema (WorkItemV2)

```ts
export type WorkItemKind = 'case' | 'change' | 'investigation'

export type WorkItemSubtype = string
// Recommended format examples:
// - case/support
// - case/sales
// - change/software
// - change/website
// - investigation/audit

export type WorkItemStatus =
  | 'Open'
  | 'InProgress'
  | 'Blocked'
  | 'Resolved'
  | 'Closed'

export interface WorkItemV2 {
  schemaVersion: 2
  workItemId: string
  workspaceId: string
  createdAtIso: string
  createdByUserId: string
  title: string
  kind: WorkItemKind
  subtype?: WorkItemSubtype
  status: WorkItemStatus
  ownerUserId?: string
  sla?: {
    dueAtIso?: string
  }
  links?: {
    externalRefs?: ExternalObjectRef[]
    runIds?: string[]
    workflowIds?: string[]
    approvalIds?: string[]
    evidenceIds?: string[]
  }
}
```

## Field Rules

### `kind`

Required.

Allowed values:

- `case` — record-centric business work
- `change` — artifact/system/environment work
- `investigation` — read-heavy analytical work

### `subtype`

Optional free-form string for MVP.

Recommended convention:

- prefix with the work kind,
- use slash-separated lower-case slugs,
- examples: `change/software`, `case/finance`, `investigation/incident`.

### `kind` immutability

`kind` is immutable in the public Work Item update contract.

Reason:

- avoids silent reclassification after runs/evidence/approvals already exist,
- simplifies audit semantics,
- keeps UI routing stable.

If reclassification is needed later, it should be an explicit audited operation rather than a casual PATCH field.

## API Surfaces

### Read

`GET /v1/workspaces/{workspaceId}/work-items/{workItemId}`

Returns `WorkItemV2`.

### List

`GET /v1/workspaces/{workspaceId}/work-items`

Supported filters:

- existing filters:
  - `status`
  - `ownerUserId`
  - `runId`
  - `workflowId`
  - `approvalId`
  - `evidenceId`
- new filter:
  - `kind`

### Create

`POST /v1/workspaces/{workspaceId}/work-items`

Request contract:

```ts
export interface CreateWorkItemRequestV2 {
  title: string
  kind: WorkItemKind
  subtype?: WorkItemSubtype
  ownerUserId?: string
  sla?: {
    dueAtIso?: string
  }
  externalRefs?: ExternalObjectRef[]
}
```

Rules:

- `title` required
- `kind` required
- `subtype` optional
- `kind` persisted exactly as normalized enum value

### Update

`PATCH /v1/workspaces/{workspaceId}/work-items/{workItemId}`

Request contract:

```ts
export interface UpdateWorkItemRequestV2 {
  title?: string
  status?: WorkItemStatus
  ownerUserId?: string
  subtype?: WorkItemSubtype
  sla?: {
    dueAtIso?: string
  }
  externalRefs?: ExternalObjectRef[]
}
```

Rules:

- at least one field required
- `kind` is intentionally not patchable
- `subtype` may be added or changed

## OpenAPI Delta

The following changes should be applied to `docs/spec/openapi/portarium-control-plane.v1.yaml`.

### New schemas

```yaml
WorkItemKind:
  type: string
  enum: [case, change, investigation]

WorkItemSubtype:
  type: string
  minLength: 1
  pattern: '^[a-z][a-z0-9-]*(/[a-z][a-z0-9-]*)?$'
```

### New query parameter

```yaml
WorkItemKindQuery:
  name: kind
  in: query
  required: false
  schema:
    $ref: '#/components/schemas/WorkItemKind'
```

### `WorkItemV1` successor shape

Preferred target shape:

```yaml
WorkItemV2:
  type: object
  additionalProperties: false
  properties:
    schemaVersion:
      type: integer
      const: 2
    workItemId:
      $ref: '#/components/schemas/WorkItemId'
    workspaceId:
      $ref: '#/components/schemas/WorkspaceId'
    createdAtIso:
      $ref: '#/components/schemas/IsoTimestamp'
    createdByUserId:
      $ref: '#/components/schemas/UserId'
    title:
      type: string
      minLength: 1
    kind:
      $ref: '#/components/schemas/WorkItemKind'
    subtype:
      $ref: '#/components/schemas/WorkItemSubtype'
    status:
      $ref: '#/components/schemas/WorkItemStatus'
    ownerUserId:
      $ref: '#/components/schemas/UserId'
    sla:
      $ref: '#/components/schemas/WorkItemSlaV1'
    links:
      $ref: '#/components/schemas/WorkItemLinksV1'
  required:
    - schemaVersion
    - workItemId
    - workspaceId
    - createdAtIso
    - createdByUserId
    - title
    - kind
    - status
```

### Create request delta

```yaml
CreateWorkItemRequest:
  type: object
  additionalProperties: false
  properties:
    title:
      type: string
      minLength: 1
    kind:
      $ref: '#/components/schemas/WorkItemKind'
    subtype:
      $ref: '#/components/schemas/WorkItemSubtype'
    ownerUserId:
      $ref: '#/components/schemas/UserId'
    sla:
      $ref: '#/components/schemas/WorkItemSlaV1'
    externalRefs:
      type: array
      items:
        $ref: '#/components/schemas/ExternalObjectRef'
  required: [title, kind]
```

### Update request delta

```yaml
UpdateWorkItemRequest:
  type: object
  additionalProperties: false
  minProperties: 1
  properties:
    title:
      type: string
      minLength: 1
    status:
      $ref: '#/components/schemas/WorkItemStatus'
    ownerUserId:
      $ref: '#/components/schemas/UserId'
    subtype:
      $ref: '#/components/schemas/WorkItemSubtype'
    sla:
      $ref: '#/components/schemas/WorkItemSlaV1'
    externalRefs:
      type: array
      items:
        $ref: '#/components/schemas/ExternalObjectRef'
```

## Transition Strategy

### Target contract

The target contract is:

- responses always include `kind`
- create requests require `kind`
- updates do not allow `kind` mutation

### Temporary compatibility mode

Because existing `/v1` clients may still omit `kind`, the implementation may temporarily support a compatibility shim:

- if `kind` is omitted, the server may infer/default before persistence,
- the stored object must still end up with a concrete `kind`,
- the response must always include normalized `kind`,
- omission handling should be treated as deprecated behavior.

This compatibility mode is an implementation bridge, not the desired steady-state contract.

## Examples

### Create a Case

```json
{
  "title": "Review refund request from ACME Pty Ltd",
  "kind": "case",
  "subtype": "case/finance"
}
```

### Create a Change

```json
{
  "title": "Fix homepage mobile layout overflow",
  "kind": "change",
  "subtype": "change/website"
}
```

### Create an Investigation

```json
{
  "title": "Diagnose repeated preview deployment failures",
  "kind": "investigation",
  "subtype": "investigation/incident"
}
```

### Read response

```json
{
  "schemaVersion": 2,
  "workItemId": "wi_123",
  "workspaceId": "ws_123",
  "createdAtIso": "2026-04-05T03:00:00Z",
  "createdByUserId": "usr_123",
  "title": "Fix homepage mobile layout overflow",
  "kind": "change",
  "subtype": "change/website",
  "status": "Open",
  "links": {
    "externalRefs": []
  }
}
```

## Query Surfaces

Required list/query support after adoption:

- list all `change` work items in a workspace,
- list all `investigation` work items owned by a user,
- drive kind-specific Cockpit tabs (`All`, `Cases`, `Changes`, `Investigations`),
- support future routing to kind-aware detail surfaces.

## Non-goals

This spec does not define:

- the full Project container contract,
- runtime lifecycle APIs,
- explicit reclassification endpoints,
- every possible subtype taxonomy,
- kind-specific detail payloads beyond the base Work Item contract.

## Follow-up Required

1. Apply the OpenAPI delta to `docs/spec/openapi/portarium-control-plane.v1.yaml`.
2. Update Cockpit boundary tests and typed endpoint consumption.
3. Add validation tests for create/update/list behavior with `kind`.
4. Add migration logic for historical Work Items that currently lack `kind`.
