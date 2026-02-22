# API Contract Alignment: Cockpit-to-Control-Plane Compatibility Layer

> **Audience**: Full-stack engineers building the Cockpit and control-plane API.
>
> **Goal**: Define the compatibility contract between the Cockpit frontend and the
> control-plane API — ensuring that Cockpit queries/mutations map to control-plane
> endpoints without impedance mismatch, and that breaking changes are detected in CI.

---

## 1. Contract strategy

The Cockpit uses the control-plane OpenAPI spec (`openapi.yaml`) as its contract.
No additional BFF (Backend For Frontend) layer is introduced at MVP — Cockpit calls
the control-plane REST API directly via a generated TypeScript client.

**Compatibility guarantee**: any change to a Cockpit-consumed endpoint that alters
the response shape, status codes, or required request fields is a **breaking change**
and must:

1. Bump the API version (path prefix: `/v1/` → `/v2/`)
2. Add an ADR explaining the migration path
3. Update the Cockpit client and its boundary tests before merging

---

## 2. Cockpit-consumed endpoints (MVP)

### 2.1 Workspace context

| Endpoint | Method | Cockpit use |
|----------|--------|-------------|
| `GET /v1/workspaces/:wsId` | Read | Workspace header, name, settings |
| `GET /v1/workspaces/:wsId/members` | List | Team member list in settings |

### 2.2 Work items

| Endpoint | Method | Cockpit use |
|----------|--------|-------------|
| `GET /v1/workspaces/:wsId/work-items` | List | Work-Item Hub table |
| `POST /v1/workspaces/:wsId/work-items` | Create | New Work Item form |
| `GET /v1/workspaces/:wsId/work-items/:id` | Read | Work-Item Detail |
| `PATCH /v1/workspaces/:wsId/work-items/:id` | Update | Edit title/description/assignee |
| `POST /v1/workspaces/:wsId/work-items/:id/archive` | Archive | Archive action |

### 2.3 Runs

| Endpoint | Method | Cockpit use |
|----------|--------|-------------|
| `GET /v1/workspaces/:wsId/runs` | List | Run Hub table |
| `POST /v1/workspaces/:wsId/work-items/:id/runs` | Start | Start Run action |
| `GET /v1/workspaces/:wsId/runs/:runId` | Read | Run Detail |
| `POST /v1/workspaces/:wsId/runs/:runId/cancel` | Cancel | Cancel action |
| `GET /v1/workspaces/:wsId/runs/:runId/evidence` | List | Evidence feed |

### 2.4 Approvals

| Endpoint | Method | Cockpit use |
|----------|--------|-------------|
| `GET /v1/workspaces/:wsId/approvals` | List | Approvals Hub (filterable by assignee, status) |
| `GET /v1/workspaces/:wsId/approvals/:id` | Read | Approval Detail |
| `POST /v1/workspaces/:wsId/approvals/:id/decide` | Decide | Approve/Reject form |

### 2.5 Evidence

| Endpoint | Method | Cockpit use |
|----------|--------|-------------|
| `GET /v1/workspaces/:wsId/evidence` | Search | Evidence Explorer (cross-run) |
| `GET /v1/workspaces/:wsId/runs/:runId/evidence/:entryId` | Read | Single entry detail |

---

## 3. Response shape contracts

### 3.1 Paginated list envelope

All `List` endpoints return:

```typescript
interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    nextCursor?: string;  // cursor-based pagination for evidence feeds
  };
}
```

### 3.2 Work item

```typescript
interface WorkItemResponse {
  id: string;            // WorkItemId branded string
  workspaceId: string;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'closed';
  assignedTo?: string;   // userId
  workflowDefinitionId?: string;
  tags: string[];
  createdAt: string;     // ISO 8601
  updatedAt: string;
}
```

### 3.3 Run

```typescript
interface RunResponse {
  id: string;            // RunId
  workItemId: string;
  workspaceId: string;
  status: 'pending' | 'running' | 'paused' | 'succeeded' | 'failed' | 'cancelled';
  correlationId: string;
  triggeredBy: string;   // userId or 'system'
  startedAt: string;
  completedAt?: string;
  evidenceCount: number;
  activeApprovalId?: string;
}
```

### 3.4 Evidence entry

```typescript
interface EvidenceEntryResponse {
  evidenceId: string;
  runId: string;
  workspaceId: string;
  correlationId: string;
  occurredAtIso: string;
  previousHash?: string;
  hashSha256: string;
  kind: string;          // e.g. 'run:step:completed', 'approval:requested'
  payload: Record<string, unknown>;
}
```

### 3.5 Approval request

```typescript
interface ApprovalRequestResponse {
  id: string;
  runId: string;
  workspaceId: string;
  checkpointName: string;
  tier: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decision?: 'approved' | 'rejected';
  comment?: string;
  aiSummary?: string;    // Assisted tier only
}
```

---

## 4. Error envelope

All error responses follow the RFC 7807 Problem Details format:

```typescript
interface ProblemDetail {
  type: string;        // URI reference identifying the problem
  title: string;       // Human-readable summary
  status: number;      // HTTP status code
  detail?: string;     // Specific explanation
  instance?: string;   // URI of the specific occurrence
  correlationId?: string;
}
```

HTTP status codes used:

| Code | Meaning | Cockpit handling |
|------|---------|-----------------|
| 400 | Validation error | Show inline field errors |
| 401 | Unauthenticated | Redirect to login |
| 403 | Unauthorised | Show "Access denied" toast |
| 404 | Not found | Show 404 page or toast |
| 409 | Conflict (optimistic lock) | Show "Refresh and retry" prompt |
| 429 | Rate limited | Exponential backoff + toast |
| 500 | Server error | Show "Something went wrong" + correlationId |

---

## 5. CI drift detection

Add `npm run ci:cockpit:api-drift` to `ci:pr` (may already exist — verify):

```bash
# scripts/ci/check-cockpit-api-drift.mjs
# 1. Load openapi.yaml
# 2. Extract all paths consumed by Cockpit (from apps/cockpit/src/api/endpoints.ts)
# 3. Assert each path exists in OpenAPI spec with expected methods
# 4. Assert response schema is compatible (no removed required fields)
# Exit non-zero if any mismatch found
```

Cockpit maintains a typed endpoint registry at `apps/cockpit/src/api/endpoints.ts`:

```typescript
// Explicit registry — CI validates this against openapi.yaml
export const COCKPIT_ENDPOINTS = [
  { method: 'GET', path: '/v1/workspaces/{wsId}/work-items' },
  { method: 'POST', path: '/v1/workspaces/{wsId}/work-items' },
  // ... (full list from section 2)
] as const;
```

---

## 6. Versioning policy

- **Non-breaking changes** (additive fields, new optional query params): allowed without version bump.
- **Breaking changes** (removed fields, changed types, removed endpoints): require `/v2/` path prefix and migration ADR.
- **Deprecation notice**: add `Deprecation: true` header + `Sunset: <date>` header 90 days before removal.

---

## 7. Related documents

| Document | Purpose |
|----------|---------|
| `docs/ui/cockpit/ia-baseline.md` | Cockpit view/data inventory |
| `docs/spec/` | OpenAPI specification |
| `docs/adr/` | Architecture decision records |
| `docs/onboarding/dev-track.md` | Developer onboarding |
