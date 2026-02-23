# Tutorial: First Work Item

## Outcome

You will run the control plane, call a workspace-scoped endpoint, and validate the scaffold-stage response behavior.

## Steps

### 1. Start runtime

```bash
npm run dev:all
npm run dev:seed
```

This starts the full stack including Postgres, the control-plane API (port 8080), and the worker. See `docs/getting-started/local-dev.md` for the dev-auth token setup.

### 2. Call workspace endpoint

With the dev token set (`PORTARIUM_DEV_TOKEN=portarium-dev-token`):

```bash
curl -i -H "Authorization: Bearer portarium-dev-token" \
  http://localhost:8080/v1/workspaces/ws-local
```

```powershell
Invoke-WebRequest http://localhost:8080/v1/workspaces/ws-local `
  -Headers @{ Authorization = "Bearer portarium-dev-token" }
```

### 3. Observe auth behavior

Without the dev token or JWT/JWKS configuration, protected routes return `401` with `application/problem+json`.

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
