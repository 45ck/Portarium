# API Contract Alignment: WorkItem.kind Across OpenAPI, Control Plane, and Cockpit

> **Audience:** engineers updating the control-plane OpenAPI contract, request validation, and Cockpit work-item surfaces.
>
> **Goal:** make the new Work Item kind model executable across the API and frontend with minimal ambiguity.

---

## 1. Why this alignment doc exists

The work-model spec adds a first-class work taxonomy:

- `case`
- `change`
- `investigation`

The current API/OpenAPI contract still represents Work Items as lightweight universal binders without a first-class `kind` field.

That gap matters because:

- Cockpit cannot reliably render kind-specific list tabs/detail panes,
- the API cannot filter work by kind,
- create flows cannot enforce the new taxonomy,
- migrations remain underspecified.

This doc bridges the architectural intent and the concrete API/frontend changes.

---

## 2. Required contract changes

### 2.1 OpenAPI schemas

Add:

- `WorkItemKind`
- `WorkItemSubtype`
- `WorkItemKindQuery`
- `WorkItemV2` (or equivalent additive successor shape)

### 2.2 Endpoint changes

`GET /v1/workspaces/{workspaceId}/work-items`
- add `kind` query support

`POST /v1/workspaces/{workspaceId}/work-items`
- accept `kind`
- require `kind` in the target contract

`GET /v1/workspaces/{workspaceId}/work-items/{workItemId}`
- always return `kind`

`PATCH /v1/workspaces/{workspaceId}/work-items/{workItemId}`
- do not allow `kind` mutation
- may allow `subtype` mutation

### 2.3 Cockpit data expectations

Cockpit should treat `kind` as a first-class routing/display field.

Minimum expectations:

- list rows/cards show the kind badge,
- Work hub supports `All / Cases / Changes / Investigations`,
- project-level work tables support the same segmentation,
- detail routes/components can switch their center pane layout by `kind`.

---

## 3. Versioning implication

There is one important contract tension.

The existing API-alignment policy says:

- additive response fields are non-breaking,
- removed/changed required fields are breaking,
- breaking changes require `/v2/` and migration work.

Adding `kind` to **responses** is additive.
Requiring `kind` on **create requests** is breaking for older clients.

### Practical resolution

Use a two-stage rollout:

#### Stage A — compatibility rollout on `/v1`

- response payloads include `kind`
- list endpoint supports `kind` filtering
- create endpoint accepts `kind`
- create endpoint may temporarily infer/default when `kind` is omitted
- omission behavior is treated as deprecated

#### Stage B — strict target contract

Either:

- require `kind` on `/v1` once all clients are migrated and the team accepts the stricter interpretation, or
- cut `/v2` if strict adherence to the documented versioning policy is desired.

For now, Stage A is the fastest path with the least disruption.

---

## 4. OpenAPI patch checklist

Apply the following concrete changes to `docs/spec/openapi/portarium-control-plane.v1.yaml`.

### 4.1 Parameters

Add:

```yaml
WorkItemKindQuery:
  name: kind
  in: query
  required: false
  schema:
    $ref: '#/components/schemas/WorkItemKind'
```

Wire it into:

```yaml
/v1/workspaces/{workspaceId}/work-items:
  get:
    parameters:
      - $ref: '#/components/parameters/WorkItemKindQuery'
```

### 4.2 Schemas

Add:

```yaml
WorkItemKind:
  type: string
  enum: [case, change, investigation]

WorkItemSubtype:
  type: string
  minLength: 1
  pattern: '^[a-z][a-z0-9-]*(/[a-z][a-z0-9-]*)?$'
```

### 4.3 Work item read model

Add `kind` and optional `subtype` to the read schema returned to clients.

### 4.4 Create request

Add `kind` and optional `subtype` to the create request schema.

### 4.5 Update request

Add `subtype` only.
Do not add mutable `kind` to the update schema.

---

## 5. Cockpit alignment checklist

### 5.1 Endpoint registry

If Cockpit keeps an explicit endpoint registry, no new endpoint paths are required.

What changes instead:

- list endpoint query params,
- response parsing/types,
- view-layer assumptions.

### 5.2 Typed client expectations

The generated/typed Work Item client type should expose:

```ts
interface WorkItemResponse {
  workItemId: string
  workspaceId: string
  title: string
  kind: 'case' | 'change' | 'investigation'
  subtype?: string
  status: 'Open' | 'InProgress' | 'Blocked' | 'Resolved' | 'Closed'
  ownerUserId?: string
}
```

### 5.3 UI behavior

Cockpit should not infer kind from external refs or titles once the API exposes it directly.

Use the API-provided `kind` as source of truth for:

- badges,
- tabs,
- filters,
- detail-pane selection,
- create-flow defaults.

---

## 6. Validation and test expectations

Add or update tests for:

### API validation

- create succeeds with valid `kind`
- create rejects invalid `kind`
- update rejects `kind` mutation attempts
- list supports `kind` filter
- read returns normalized `kind`

### Compatibility

If Stage A compatibility mode is enabled:

- create without `kind` still persists a normalized `kind`
- responses still always include `kind`
- omission path is marked deprecated in tests/docs

### Cockpit boundary tests

- work-item list renders kind badges from API values
- kind-filtered tabs emit the correct `kind` query
- detail page routes/layouts change based on returned `kind`

---

## 7. Migration expectations

Historical Work Items without `kind` should not leak to clients after migration.

API-facing invariant:

- every returned Work Item must have a concrete `kind`

Implementation options:

- pre-migrate persisted data,
- or normalize during read-through before returning the object,
- but client-visible `null` / missing `kind` is not acceptable once rollout begins.

---

## 8. Recommended next actions after this doc

1. Patch `docs/spec/openapi/portarium-control-plane.v1.yaml`.
2. Patch OpenAPI contract tests.
3. Patch Work Item request validation and persistence.
4. Patch Cockpit typed client and work-list/detail views.
5. Add migration/backfill logic for existing Work Items.

---

## 9. Related documents

- `docs/internal/specs/work-model-case-change-investigation.md`
- `docs/adr/0066-work-runtime-canonical-name-and-boundaries.md`
- `.specify/specs/work-item-v2.md`
- `docs/integration/cockpit-api-contract-alignment.md`
