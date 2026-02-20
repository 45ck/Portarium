# Tutorial: Evidence Trace

## Outcome

You will complete a Human Task and view the resulting Evidence entry.

## Prerequisites

- Control plane runtime is running.
- JWT auth is configured with `PORTARIUM_JWKS_URI` (and optional issuer/audience checks).
- You have a valid bearer token with:
  - `sub`
  - `workspaceId: "workspace-1"`
  - `roles` including `operator` or `admin`

## Steps

### 1. Start control plane runtime

```bash
npx tsx src/presentation/runtime/control-plane.ts
```

### 2. Complete a Human Task (auth required)

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"completionNote":"Reviewed and approved"}' \
  http://localhost:8080/v1/workspaces/workspace-1/human-tasks/ht-1/complete
```

```powershell
$headers = @{ Authorization = "Bearer <token>"; "Content-Type" = "application/json" }
$body = '{"completionNote":"Reviewed and approved"}'
Invoke-WebRequest `
  http://localhost:8080/v1/workspaces/workspace-1/human-tasks/ht-1/complete `
  -Method POST `
  -Headers $headers `
  -Body $body
```

### 3. Query Evidence

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8080/v1/workspaces/workspace-1/evidence?runId=run-101"
```

```powershell
Invoke-WebRequest `
  "http://localhost:8080/v1/workspaces/workspace-1/evidence?runId=run-101" `
  -Headers @{ Authorization = "Bearer <token>" } `
  -Method GET
```

## Notes

- Runtime uses fixture-backed behavior in scaffold stage.
- Evidence persistence adapters are still in progress.
- Without valid JWT/JWKS setup, these calls return `401 Unauthorized`.

## Source of truth

- `src/presentation/runtime/control-plane-handler.ts`
- `docs/adr/0029-evidence-integrity-tamper-evident.md`
