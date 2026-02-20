# Tutorial: First Work Item

## Outcome

You will run the control plane, call a workspace-scoped endpoint, and validate the scaffold-stage response behavior.

## Steps

### 1. Start runtime

```bash
npx tsx src/presentation/runtime/control-plane.ts
```

### 2. Call workspace endpoint

```bash
curl -i http://localhost:8080/v1/workspaces/workspace-1
```

```powershell
Invoke-WebRequest http://localhost:8080/v1/workspaces/workspace-1 -Method GET
```

### 3. Observe auth behavior

Without JWT/JWKS configuration, protected routes return `401` with `application/problem+json`.

### 4. Configure auth (optional)

Set:

- `PORTARIUM_JWKS_URI`
- `PORTARIUM_JWT_ISSUER` (optional)
- `PORTARIUM_JWT_AUDIENCE` (optional)

Your token must include claims:

- `sub` (user id)
- `workspaceId` (must match route workspace id)
- `roles` (non-empty array of `admin|operator|approver|auditor`)

Then retry with bearer token.

### 5. Confirm scaffold behavior with auth enabled

The current workspace store is stubbed in this scaffold stage, so this endpoint is expected to return `404 Not Found` even with valid auth.

## Source of truth

- `docs/spec/openapi/portarium-control-plane.v1.yaml`
- `src/presentation/runtime/control-plane-handler.ts`
