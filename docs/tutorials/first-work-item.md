# Tutorial: First Work Item

## Outcome

You will run the control plane, call a workspace-scoped endpoint, and inspect the current response contract shape.

## Steps

### 1. Start runtime

```bash
npx tsx src/presentation/runtime/control-plane.ts
```

### 2. Call workspace endpoint

```bash
curl -i http://localhost:8080/v1/workspaces/workspace-1
```

### 3. Observe auth behavior

Without JWT/JWKS configuration, protected routes return `401` with `application/problem+json`.

### 4. Configure auth (optional)

Set:

- `PORTARIUM_JWKS_URI`
- `PORTARIUM_JWT_ISSUER` (optional)
- `PORTARIUM_JWT_AUDIENCE` (optional)

Then retry with bearer token.

## Source of truth

- `docs/spec/openapi/portarium-control-plane.v1.yaml`
- `src/presentation/runtime/control-plane-handler.ts`
