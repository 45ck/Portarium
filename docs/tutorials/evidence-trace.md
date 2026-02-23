# Tutorial: Evidence Trace

## Outcome

You will complete a Human Task and view the resulting Evidence entry.

## Prerequisites

- The local stack is running (see [Local Dev Guide](../getting-started/local-dev.md)).
- `PORTARIUM_DEV_TOKEN=portarium-dev-token` is set for dev-auth bypass.

## Steps

### 1. Start the local stack

```bash
npm run dev:all
npm run dev:seed
export PORTARIUM_DEV_TOKEN=portarium-dev-token
export PORTARIUM_DEV_WORKSPACE_ID=workspace-1
```

### 2. Complete a Human Task

```bash
curl -X POST \
  -H "Authorization: Bearer portarium-dev-token" \
  -H "Content-Type: application/json" \
  -d '{"completionNote":"Reviewed and approved"}' \
  http://localhost:8080/v1/workspaces/workspace-1/human-tasks/ht-1/complete
```

```powershell
$headers = @{ Authorization = "Bearer portarium-dev-token"; "Content-Type" = "application/json" }
$body = '{"completionNote":"Reviewed and approved"}'
Invoke-WebRequest `
  http://localhost:8080/v1/workspaces/workspace-1/human-tasks/ht-1/complete `
  -Method POST `
  -Headers $headers `
  -Body $body
```

### 3. Query Evidence

```bash
curl -H "Authorization: Bearer portarium-dev-token" \
  "http://localhost:8080/v1/workspaces/workspace-1/evidence?runId=run-101"
```

```powershell
Invoke-WebRequest `
  "http://localhost:8080/v1/workspaces/workspace-1/evidence?runId=run-101" `
  -Headers @{ Authorization = "Bearer portarium-dev-token" } `
  -Method GET
```

## Notes

- Without `PORTARIUM_DEV_TOKEN` set or JWT/JWKS config, these calls return `401 Unauthorized`.

## Source of truth

- `src/presentation/runtime/control-plane-handler.ts`
- `docs/adr/0029-evidence-integrity-tamper-evident.md`
